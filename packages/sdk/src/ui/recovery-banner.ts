import { RecoverableSession } from '../types';
import { formatBytes, formatDuration } from '../utils/time';
import { BANNER_STYLES } from './styles';

export class RecoveryBanner {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;

  constructor(private recoverable: RecoverableSession) {}

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-banner');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = BANNER_STYLES;
    this.shadowRoot.appendChild(styleEl);

    const bannerWrapper = document.createElement('div');
    const elapsedSecs = Math.floor(this.recoverable.metadata.elapsedMs / 1000);
    
    bannerWrapper.innerHTML = `
      <div class="sat-banner">
        <svg style="width: 22px; height: 22px; fill: #60a5fa; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <div class="sat-banner-text">
          <span class="sat-banner-title">Unsaved Screen Recording Found</span>
          <span class="sat-banner-desc">Recovered from previous session (${formatDuration(elapsedSecs)}, ${formatBytes(this.recoverable.totalBytes)})</span>
        </div>
        <div class="sat-banner-actions">
          <button class="sat-banner-btn sat-banner-btn-discard">Discard</button>
          <button class="sat-banner-btn sat-banner-btn-recover">Download Video</button>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(bannerWrapper);
    document.body.appendChild(this.hostElement);

    const discardBtn = this.shadowRoot.querySelector('.sat-banner-btn-discard');
    const recoverBtn = this.shadowRoot.querySelector('.sat-banner-btn-recover');

    discardBtn?.addEventListener('click', async () => {
      await this.recoverable.discard();
      this.destroy();
    });

    recoverBtn?.addEventListener('click', async () => {
      const result = await this.recoverable.assemble();
      result.download();
      await this.recoverable.discard();
      this.destroy();
    });
  }

  destroy(): void {
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
  }
}
