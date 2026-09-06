import { DomConfig, SerializedNode } from '../types';

export interface SerializationContext {
  nodeToId: Map<Node, number>;
  idToNode: Map<number, Node>;
  nextId: number;
  config: DomConfig;
}

export function createSerializationContext(config: DomConfig = {}): SerializationContext {
  return {
    nodeToId: new Map(),
    idToNode: new Map(),
    nextId: 1,
    config: {
      maskAllInputs: config.maskAllInputs ?? true,
      maskAllText: config.maskAllText ?? false,
      maskTextClass: config.maskTextClass ?? 'sat-mask',
      unmaskClass: config.unmaskClass ?? 'sat-unmask',
      maskSelector: config.maskSelector,
      unmaskSelector: config.unmaskSelector,
      maskInputSelector: config.maskInputSelector,
      unmaskInputSelector: config.unmaskInputSelector,
      maskTextSelector: config.maskTextSelector,
      unmaskTextSelector: config.unmaskTextSelector,
      blockClass: config.blockClass ?? 'sat-block',
      recordMouse: config.recordMouse ?? true,
      mouseThrottleMs: config.mouseThrottleMs ?? 50
    }
  };
}

export function elementMatches(el: Element, selector?: string): boolean {
  if (!selector || !el || typeof el.matches !== 'function') return false;
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

export function getClosestMatch(el: Element | null, selector?: string): Element | null {
  if (!el || !selector) return null;
  if (typeof el.closest === 'function') {
    try {
      return el.closest(selector);
    } catch {
      return null;
    }
  }
  let curr: Element | null = el;
  while (curr) {
    if (elementMatches(curr, selector)) return curr;
    curr = curr.parentElement;
  }
  return null;
}

export function getClosestMaskElement(el: Element | null, ctx: SerializationContext): Element | null {
  if (!el) return null;
  const maskClass = ctx.config.maskTextClass || 'sat-mask';
  const classSelector = `.${maskClass}, [data-sat-mask]`;
  
  let closestEl = getClosestMatch(el, classSelector);
  
  const selectors = [
    ctx.config.maskSelector,
    ctx.config.maskInputSelector,
    ctx.config.maskTextSelector
  ].filter(Boolean) as string[];

  for (const sel of selectors) {
    const match = getClosestMatch(el, sel);
    if (match) {
      if (!closestEl || match.contains(closestEl)) {
        closestEl = match;
      }
    }
  }

  return closestEl;
}

export function getClosestUnmaskElement(el: Element | null, ctx: SerializationContext): Element | null {
  if (!el) return null;
  const unmaskClass = ctx.config.unmaskClass || 'sat-unmask';
  const classSelector = `.${unmaskClass}, [data-sat-unmask], [data-sat-record]`;
  
  let closestEl = getClosestMatch(el, classSelector);
  
  const selectors = [
    ctx.config.unmaskSelector,
    ctx.config.unmaskInputSelector,
    ctx.config.unmaskTextSelector
  ].filter(Boolean) as string[];

  for (const sel of selectors) {
    const match = getClosestMatch(el, sel);
    if (match) {
      if (!closestEl || match.contains(closestEl)) {
        closestEl = match;
      }
    }
  }

  return closestEl;
}

export function isElementMaskedWithPrecedence(el: Element | null, ctx: SerializationContext): boolean | null {
  if (!el) return null;
  const maskNode = getClosestMaskElement(el, ctx);
  const unmaskNode = getClosestUnmaskElement(el, ctx);

  if (!maskNode && !unmaskNode) {
    return null;
  }
  if (maskNode && !unmaskNode) {
    return true;
  }
  if (unmaskNode && !maskNode) {
    return false;
  }

  // If both exist, determine which is closer to `el`
  if (maskNode && unmaskNode) {
    if (maskNode === unmaskNode) {
      return false; // Explicit unmask on same node takes priority
    }
    // If maskNode contains unmaskNode, unmaskNode is closer to el
    if (maskNode.contains(unmaskNode)) {
      return false;
    }
    // If unmaskNode contains maskNode, maskNode is closer to el
    if (unmaskNode.contains(maskNode)) {
      return true;
    }
  }

  return true;
}

export function isElementMasked(el: Element | null, ctx: SerializationContext): boolean {
  return isElementMaskedWithPrecedence(el, ctx) === true;
}

export function isElementUnmasked(el: Element | null, ctx: SerializationContext): boolean {
  return isElementMaskedWithPrecedence(el, ctx) === false;
}

export function isTextMasked(parentEl: Element | null, ctx: SerializationContext): boolean {
  if (!parentEl) return false;
  const explicit = isElementMaskedWithPrecedence(parentEl, ctx);
  if (explicit !== null) {
    return explicit;
  }
  return ctx.config.maskAllText ?? false;
}

export function isInputMasked(el: HTMLElement, ctx: SerializationContext): boolean {
  if (el instanceof HTMLInputElement && el.type === 'password') {
    return true; // Passwords are always masked for safety
  }
  const explicit = isElementMaskedWithPrecedence(el, ctx);
  if (explicit !== null) {
    return explicit;
  }
  // Standard select dropdowns contain predetermined choices; mask only if explicitly requested
  if (el instanceof HTMLSelectElement || (el.tagName && el.tagName.toLowerCase() === 'select')) {
    return false;
  }
  return ctx.config.maskAllInputs ?? true;
}

export function shouldIgnoreNode(node: Node, ctx: SerializationContext): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  // Ignore ShowAndTell UI components and scripts
  if (tagName.startsWith('show-and-tell-') || tagName === 'script') {
    return true;
  }

  // Ignore user-specified or internal ignore classes
  const blockClass = ctx.config.blockClass || 'sat-block';
  if (el.classList.contains('sat-ignore') || 
      el.classList.contains('snt-ignore') || 
      el.classList.contains(blockClass) || 
      el.hasAttribute('data-sat-ignore') || 
      el.hasAttribute('data-sat-block')) {
    return true;
  }

  return false;
}

export function maskString(str: string): string {
  return str.replace(/[a-zA-Z0-9]/g, '*');
}

export function serializeNode(node: Node, ctx: SerializationContext): SerializedNode | null {
  if (shouldIgnoreNode(node, ctx)) {
    return null;
  }

  let id = ctx.nodeToId.get(node);
  if (id === undefined) {
    id = ctx.nextId++;
    ctx.nodeToId.set(node, id);
    ctx.idToNode.set(id, node);
  }

  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent || '';
    if (isTextMasked(node.parentElement, ctx)) {
      text = maskString(text);
    }
    return {
      id,
      type: 'text',
      textContent: text
    };
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const attributes: Record<string, string> = {};

    // Copy all attributes
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      attributes[attr.name] = attr.value;
    }

    // Resolve relative URLs to absolute for stylesheets and images
    if (tagName === 'link' && (el as HTMLLinkElement).href) {
      attributes['href'] = (el as HTMLLinkElement).href;
    } else if (tagName === 'img' && (el as HTMLImageElement).src) {
      attributes['src'] = (el as HTMLImageElement).src;
    } else if (tagName === 'option') {
      const opt = el as HTMLOptionElement;
      if (opt.selected) {
        attributes['selected'] = '';
      }
      if (opt.value !== undefined) {
        attributes['value'] = opt.value;
      }
    }

    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    let value: string | boolean | undefined;
    let selectedIndex: number | undefined;

    if (isInput) {
      const inputEl = el as HTMLInputElement;
      const isMasked = isInputMasked(el, ctx);

      if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
        value = inputEl.checked;
      } else if (tagName === 'select') {
        const sel = el as HTMLSelectElement;
        value = isMasked ? '' : sel.value;
        selectedIndex = isMasked ? -1 : sel.selectedIndex;
      } else {
        const rawVal = inputEl.value || '';
        value = isMasked ? '••••••••' : rawVal;
      }
    }

    // Serialize children
    const children: SerializedNode[] = [];

    // If <style> element with CSS rules inserted via JS
    if (tagName === 'style' && node.childNodes.length === 0) {
      try {
        const sheet = (el as HTMLStyleElement).sheet;
        if (sheet && sheet.cssRules && sheet.cssRules.length > 0) {
          const css = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
          if (css) {
            const styleTextId = ctx.nextId++;
            children.push({
              id: styleTextId,
              type: 'text',
              textContent: css
            });
          }
        }
      } catch {}
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      const serializedChild = serializeNode(child, ctx);
      if (serializedChild) {
        children.push(serializedChild);
      }
    }

    return {
      id,
      type: 'element',
      tagName,
      attributes,
      children,
      isInput,
      value,
      selectedIndex
    };
  }

  return null;
}
