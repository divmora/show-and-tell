import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createSerializationContext, 
  serializeNode, 
  shouldIgnoreNode, 
  isElementMasked 
} from './serializer';

describe('DOM Serializer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('serializes a standard DOM hierarchy into virtual nodes', () => {
    document.body.innerHTML = `
      <div id="test-wrapper" class="container">
        <h1>Welcome</h1>
        <p>This is a test paragraph.</p>
      </div>
    `;

    const ctx = createSerializationContext();
    const wrapper = document.getElementById('test-wrapper')!;
    const serialized = serializeNode(wrapper, ctx);

    expect(serialized).not.toBeNull();
    expect(serialized?.tagName).toBe('div');
    expect(serialized?.attributes?.id).toBe('test-wrapper');
    expect(serialized?.attributes?.class).toBe('container');
    expect(serialized?.children?.length).toBeGreaterThan(0);

    const h1 = serialized?.children?.find(c => c.tagName === 'h1');
    expect(h1).toBeDefined();
    expect(h1?.children?.[0]?.textContent).toBe('Welcome');
  });

  it('masks password inputs automatically', () => {
    document.body.innerHTML = `
      <input type="password" id="secretPass" value="SuperSecret123" />
    `;

    const ctx = createSerializationContext({ maskAllInputs: false });
    const passInput = document.getElementById('secretPass')!;
    const serialized = serializeNode(passInput, ctx);

    expect(serialized?.isInput).toBe(true);
    expect(serialized?.value).toBe('••••••••');
  });

  it('masks form inputs when maskAllInputs is true (default)', () => {
    document.body.innerHTML = `
      <input type="text" id="email" value="user@example.com" />
    `;

    const ctx = createSerializationContext({ maskAllInputs: true });
    const emailInput = document.getElementById('email')!;
    const serialized = serializeNode(emailInput, ctx);

    expect(serialized?.value).toBe('••••••••');
  });

  it('masks text inside elements tagged with mask class', () => {
    document.body.innerHTML = `
      <div class="sat-mask" id="sensitiveArea">
        Account 12345
      </div>
    `;

    const ctx = createSerializationContext();
    const sensitive = document.getElementById('sensitiveArea')!;
    expect(isElementMasked(sensitive, ctx)).toBe(true);

    const serialized = serializeNode(sensitive, ctx);
    const textChild = serialized?.children?.[0];
    expect(textChild?.textContent?.trim()).toBe('******* *****');
  });

  it('ignores ShowAndTell custom elements and ignored classes', () => {
    document.body.innerHTML = `
      <show-and-tell-widget id="widget"></show-and-tell-widget>
      <div class="sat-ignore" id="ignored1"></div>
      <div class="sat-block" id="ignored2"></div>
      <script id="ignoredScript">console.log(1);</script>
      <div id="valid">Hello</div>
    `;

    const ctx = createSerializationContext();

    const widget = document.getElementById('widget')!;
    expect(shouldIgnoreNode(widget, ctx)).toBe(true);
    expect(serializeNode(widget, ctx)).toBeNull();

    const ignored1 = document.getElementById('ignored1')!;
    expect(shouldIgnoreNode(ignored1, ctx)).toBe(true);
    expect(serializeNode(ignored1, ctx)).toBeNull();

    const valid = document.getElementById('valid')!;
    expect(shouldIgnoreNode(valid, ctx)).toBe(false);
    expect(serializeNode(valid, ctx)).not.toBeNull();
  });

  it('supports masking certain fields only (maskAllInputs: false)', () => {
    document.body.innerHTML = `
      <input type="text" id="normalInput" value="Visible Search Query" />
      <input type="text" id="maskedInput1" class="sat-mask" value="Class Masked Field" />
      <input type="text" id="maskedInput2" data-sat-mask value="Attr Masked Field" />
      <input type="text" id="selectorMasked" name="creditCard" value="4111222233334444" />
      <input type="password" id="passField" value="MySecretPass" />
    `;

    const ctx = createSerializationContext({
      maskAllInputs: false,
      maskInputSelector: 'input[name="creditCard"]'
    });

    const normal = serializeNode(document.getElementById('normalInput')!, ctx);
    const masked1 = serializeNode(document.getElementById('maskedInput1')!, ctx);
    const masked2 = serializeNode(document.getElementById('maskedInput2')!, ctx);
    const selectorMasked = serializeNode(document.getElementById('selectorMasked')!, ctx);
    const pass = serializeNode(document.getElementById('passField')!, ctx);

    // Normal input is preserved
    expect(normal?.value).toBe('Visible Search Query');
    // Specific fields are masked
    expect(masked1?.value).toBe('••••••••');
    expect(masked2?.value).toBe('••••••••');
    expect(selectorMasked?.value).toBe('••••••••');
    expect(pass?.value).toBe('••••••••');
  });

  it('supports unmasking specific fields when maskAllInputs is true', () => {
    document.body.innerHTML = `
      <input type="text" id="normalInput" value="Sensitive Info" />
      <input type="text" id="unmaskedClass" class="sat-unmask" value="Public Feedback" />
      <input type="text" id="unmaskedAttr" data-sat-unmask value="Public Note" />
      <input type="text" id="searchBox" value="Search Terms" />
      <input type="password" id="passField" class="sat-unmask" value="SecretPassword" />
    `;

    const ctx = createSerializationContext({
      maskAllInputs: true,
      unmaskInputSelector: '#searchBox'
    });

    const normal = serializeNode(document.getElementById('normalInput')!, ctx);
    const unmasked1 = serializeNode(document.getElementById('unmaskedClass')!, ctx);
    const unmasked2 = serializeNode(document.getElementById('unmaskedAttr')!, ctx);
    const selectorUnmasked = serializeNode(document.getElementById('searchBox')!, ctx);
    const pass = serializeNode(document.getElementById('passField')!, ctx);

    // Default input is masked
    expect(normal?.value).toBe('••••••••');
    // Explicitly unmasked fields are preserved
    expect(unmasked1?.value).toBe('Public Feedback');
    expect(unmasked2?.value).toBe('Public Note');
    expect(selectorUnmasked?.value).toBe('Search Terms');
    // Passwords remain masked even if sat-unmask is present
    expect(pass?.value).toBe('••••••••');
  });

  it('masks specific text and text-type inputs (e.g. Aadhar, PAN) via maskSelector', () => {
    document.body.innerHTML = `
      <div id="userProfile">
        <h2 id="userName">John Doe</h2>
        <p>Aadhar: <span id="aadharDisplay">1234 5678 9012</span></p>
        <p>PAN Card: <span class="pan-number">ABCDE1234F</span></p>
        <input type="text" id="aadharInput" value="1234 5678 9012" />
        <input type="text" class="pan-input" value="ABCDE1234F" />
        <input type="text" id="generalNotes" value="General meeting notes" />
      </div>
    `;

    const ctx = createSerializationContext({
      maskAllInputs: false,
      maskAllText: false,
      maskSelector: '#aadharDisplay, .pan-number, #aadharInput, .pan-input'
    });

    const serialized = serializeNode(document.getElementById('userProfile')!, ctx);
    expect(serialized).not.toBeNull();

    // Regular text (John Doe) remains unmasked
    const nameText = document.getElementById('userName')!.firstChild!;
    expect(serializeNode(nameText, ctx)?.textContent).toBe('John Doe');

    // Aadhar text is masked to digits/letters replaced by *
    const aadharText = document.getElementById('aadharDisplay')!.firstChild!;
    expect(serializeNode(aadharText, ctx)?.textContent).toBe('**** **** ****');

    // PAN text is masked
    const panText = document.querySelector('.pan-number')!.firstChild!;
    expect(serializeNode(panText, ctx)?.textContent).toBe('**********');

    // Aadhar text-type input is masked
    const aadharInputNode = serializeNode(document.getElementById('aadharInput')!, ctx);
    expect(aadharInputNode?.value).toBe('••••••••');

    // PAN text-type input is masked
    const panInputNode = serializeNode(document.querySelector('.pan-input')!, ctx);
    expect(panInputNode?.value).toBe('••••••••');

    // General text-type input is NOT masked
    const generalNotesNode = serializeNode(document.getElementById('generalNotes')!, ctx);
    expect(generalNotesNode?.value).toBe('General meeting notes');
  });

  it('masks all text on page when maskAllText is true except unmasked selectors/classes', () => {
    document.body.innerHTML = `
      <div id="wrapper">
        <h1 id="pageTitle" class="sat-unmask">Public Heading</h1>
        <p id="description">Sensitive confidential paragraph content.</p>
        <span id="whiteListedTag">Always Visible Tag</span>
      </div>
    `;

    const ctx = createSerializationContext({
      maskAllText: true,
      unmaskSelector: '#whiteListedTag'
    });

    // Explicitly unmasked via class remains visible
    const titleText = document.getElementById('pageTitle')!.firstChild!;
    expect(serializeNode(titleText, ctx)?.textContent).toBe('Public Heading');

    // Default text is masked
    const descText = document.getElementById('description')!.firstChild!;
    expect(serializeNode(descText, ctx)?.textContent).toBe('********* ************ ********* *******.');

    // Explicitly unmasked via selector remains visible
    const tagText = document.getElementById('whiteListedTag')!.firstChild!;
    expect(serializeNode(tagText, ctx)?.textContent).toBe('Always Visible Tag');
  });

  it('masks all inputs under a parent container (div, form, section) via class or selector', () => {
    document.body.innerHTML = `
      <div id="outsideContainer">
        <input type="text" id="outsideInput" value="Outside Input" />
      </div>

      <!-- Parent container masked via sat-mask class -->
      <div class="sat-mask" id="paymentSection">
        <div class="row">
          <input type="text" id="cardHolder" value="Jane Doe" />
          <input type="text" id="cardNumber" value="4111 2222 3333 4444" />
        </div>
        <textarea id="billingAddress">123 Secret St, Apt 4B</textarea>
        <!-- Exception inside masked parent -->
        <input type="text" id="country" class="sat-unmask" value="India" />
      </div>

      <!-- Parent container masked via CSS selector -->
      <form id="kycForm">
        <input type="text" id="aadharField" value="1234 5678 9012" />
        <input type="text" id="panField" value="ABCDE1234F" />
        <select id="incomeRange">
          <option value="high" selected>10-20 Lakhs</option>
        </select>
      </form>
    `;

    const ctx = createSerializationContext({
      maskAllInputs: false,
      maskSelector: '#kycForm'
    });

    // Outside input is NOT masked
    const outsideNode = serializeNode(document.getElementById('outsideInput')!, ctx);
    expect(outsideNode?.value).toBe('Outside Input');

    // Inputs inside .sat-mask parent container ARE masked
    const cardHolderNode = serializeNode(document.getElementById('cardHolder')!, ctx);
    const cardNumberNode = serializeNode(document.getElementById('cardNumber')!, ctx);
    const addressNode = serializeNode(document.getElementById('billingAddress')!, ctx);
    expect(cardHolderNode?.value).toBe('••••••••');
    expect(cardNumberNode?.value).toBe('••••••••');
    expect(addressNode?.value).toBe('••••••••');

    // Child with sat-unmask inside the masked container is UNMASKED
    const countryNode = serializeNode(document.getElementById('country')!, ctx);
    expect(countryNode?.value).toBe('India');

    // All inputs & selects under #kycForm parent are MASKED
    const aadharNode = serializeNode(document.getElementById('aadharField')!, ctx);
    const panNode = serializeNode(document.getElementById('panField')!, ctx);
    expect(aadharNode?.value).toBe('••••••••');
    expect(panNode?.value).toBe('••••••••');
  });

  it('supports multilevel scoped selectors to distinguish duplicate IDs (e.g. #customerScope #kycForm vs #merchantScope #kycForm)', () => {
    document.body.innerHTML = `
      <div id="customerScope" class="tab-panel active">
        <!-- Duplicate ID: kycForm in customer scope -->
        <form id="kycForm">
          <input type="text" id="customerAadhar" name="aadhar" value="1234 5678 9012" />
          <input type="text" id="customerPan" name="pan" value="ABCDE1234F" />
        </form>
      </div>

      <div id="merchantScope" class="tab-panel">
        <!-- Duplicate ID: kycForm in merchant scope -->
        <form id="kycForm">
          <input type="text" id="merchantGstin" name="gstin" value="22AAAAA0000A1Z5" />
          <input type="text" id="merchantName" name="company" value="Acme Corp" />
        </form>
      </div>

      <!-- Multilevel nested selector test with classes and tags -->
      <section class="modal-dialog">
        <div class="step-2">
          <div class="user-fields">
            <span class="confidential-doc">SECRET-DOC-999</span>
          </div>
        </div>
      </section>
    `;

    const ctx = createSerializationContext({
      maskAllInputs: false,
      maskAllText: false,
      // Target duplicate #kycForm inside #customerScope only, plus a 4-level deep selector
      maskSelector: '#customerScope #kycForm, .modal-dialog .step-2 .user-fields .confidential-doc'
    });

    // Customer form inputs ARE masked
    const aadharNode = serializeNode(document.getElementById('customerAadhar')!, ctx);
    const panNode = serializeNode(document.getElementById('customerPan')!, ctx);
    expect(aadharNode?.value).toBe('••••••••');
    expect(panNode?.value).toBe('••••••••');

    // Merchant form inputs (with the exact same form ID #kycForm) are NOT masked!
    const gstinNode = serializeNode(document.getElementById('merchantGstin')!, ctx);
    const merchantNameNode = serializeNode(document.getElementById('merchantName')!, ctx);
    expect(gstinNode?.value).toBe('22AAAAA0000A1Z5');
    expect(merchantNameNode?.value).toBe('Acme Corp');

    // 4-level deep nested selector text is masked
    const docSpanText = document.querySelector('.confidential-doc')!.firstChild!;
    expect(serializeNode(docSpanText, ctx)?.textContent).toBe('******-***-***');
  });

  it('correctly serializes select elements and option selected states', () => {
    document.body.innerHTML = `
      <select id="categorySelect">
        <option value="billing">Billing</option>
        <option value="tech" selected>Technical</option>
        <option value="general">General</option>
      </select>
    `;

    const ctx = createSerializationContext({ maskAllInputs: false });
    const selectEl = document.getElementById('categorySelect') as HTMLSelectElement;
    const serialized = serializeNode(selectEl, ctx);

    expect(serialized?.isInput).toBe(true);
    expect(serialized?.value).toBe('tech');
    expect(serialized?.selectedIndex).toBe(1);

    const selectedOption = serialized?.children?.find(c => c.attributes?.value === 'tech');
    expect(selectedOption?.attributes?.selected).toBeDefined();
  });
});
