import * as mediasoup from 'mediasoup';
import type { Worker, Router, RtpCodecCapability } from 'mediasoup/node/lib/types';
import type { Logger } from 'pino';

export class SFU {
  private worker: Worker | null = null;
  public router: Router | null = null;

  constructor(private logger: Logger) {}

  async start() {
    if (this.worker) return;
    this.worker = await mediasoup.createWorker();
    this.worker.on('died', () => {
      this.logger.error('Mediasoup worker died, exiting');
      process.exit(1);
    });

    const mediaCodecs: RtpCodecCapability[] = [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2, preferredPayloadType: 111 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, preferredPayloadType: 96 },
      { kind: 'video', mimeType: 'video/H264', clockRate: 90000, preferredPayloadType: 102, parameters: { 'packetization-mode': 1, 'level-asymmetry-allowed': 1, 'profile-level-id': '42e01f' } },
    ];
    this.router = await this.worker.createRouter({ mediaCodecs });
    this.logger.info('Mediasoup router created');
  }

  getRtpCapabilities() {
    if (!this.router) return null;
    return this.router.rtpCapabilities;
  }
}
