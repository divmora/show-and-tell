import { RecordingResult } from '../types';
import { formatBytes, formatDuration } from '../utils/time';
import { MODAL_STYLES } from './styles';

export class PreviewModal {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;

  constructor(private result: RecordingResult, private uploadEndpoint?: string) {}

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-modal');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = MODAL_STYLES;
    this.shadowRoot.appendChild(styleEl);

    const dialogWrapper = document.createElement('div');
    dialogWrapper.innerHTML = `
      <div class="sat-modal-backdrop"></div>
      <div class="sat-modal-dialog">
        <div class="sat-modal-header">
          <h3 class="sat-modal-title">
            <svg style="width: 18px; height: 18px; fill: #2563eb;" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            Recording Ready
          </h3>
          <button class="sat-close-btn" title="Close">
            <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="sat-modal-body">
          <div class="sat-video-container">
            <video src="${this.result.url}" controls autoplay playsinline></video>
          </div>
          <div class="sat-meta-grid">
            <div class="sat-meta-item">
              <span class="sat-meta-label">Duration</span>
              <span class="sat-meta-value">${formatDuration(this.result.duration)}</span>
            </div>
            <div class="sat-meta-item">
              <span class="sat-meta-label">File Size</span>
              <span class="sat-meta-value">${formatBytes(this.result.size)}</span>
            </div>
            <div class="sat-meta-item">
              <span class="sat-meta-label">Format</span>
              <span class="sat-meta-value">${this.result.mimeType.split(';')[0]}</span>
            </div>
          </div>
        </div>
        <div class="sat-modal-footer">
          <button class="sat-action-btn sat-action-btn-secondary sat-btn-dismiss">
            Close
          </button>
          ${this.uploadEndpoint ? `
            <button class="sat-action-btn sat-action-btn-secondary sat-btn-upload">
              <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
              Upload to Server
            </button>
          ` : ''}
          <button class="sat-action-btn sat-action-btn-primary sat-btn-download">
            <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
            Download Video
          </button>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(dialogWrapper);
    document.body.appendChild(this.hostElement);

    const closeBtn = this.shadowRoot.querySelector('.sat-close-btn');
    const dismissBtn = this.shadowRoot.querySelector('.sat-btn-dismiss');
    const backdrop = this.shadowRoot.querySelector('.sat-modal-backdrop');
    const downloadBtn = this.shadowRoot.querySelector('.sat-btn-download');
    const uploadBtn = this.shadowRoot.querySelector('.sat-btn-upload');

    const handleClose = () => this.destroy();
    closeBtn?.addEventListener('click', handleClose);
    dismissBtn?.addEventListener('click', handleClose);
    backdrop?.addEventListener('click', handleClose);

    downloadBtn?.addEventListener('click', () => {
      this.result.download();
    });

    if (uploadBtn && this.uploadEndpoint) {
      uploadBtn.addEventListener('click', async () => {
        uploadBtn.textContent = 'Uploading...';
        (uploadBtn as HTMLButtonElement).disabled = true;
        try {
          await this.result.upload(this.uploadEndpoint!);
          uploadBtn.textContent = 'Uploaded Successfully!';
        } catch (err: any) {
          uploadBtn.textContent = 'Upload Failed';
          console.error('[ShowAndTell] Upload error:', err);
        }
      });
    }
  }

  destroy(): void {
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
  }
}
