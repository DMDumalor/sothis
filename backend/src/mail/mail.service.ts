import { Injectable, Logger } from '@nestjs/common';

/**
 * Abstracted mail transport. Wired to a console/log transport in dev since
 * no SMTP/SES credentials were supplied (see architecture plan, "Known
 * trade-offs"). Swap the body of these methods for a real provider without
 * touching any caller.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService[console-transport]');

  async sendAccountInvitation(params: {
    to: string;
    organizationCode: string;
    activationUrl: string;
    invitedByName: string;
  }) {
    this.logger.log(
      `Account invitation for ${params.to} (org ${params.organizationCode}), ` +
        `invited by ${params.invitedByName}. Activation link: ${params.activationUrl}`,
    );
  }

  async sendPasswordReset(params: { to: string; resetUrl: string }) {
    this.logger.log(`Password reset for ${params.to}. Link: ${params.resetUrl}`);
  }
}
