import { Injectable } from '@nestjs/common';
import { NotificationType } from '../dto';

@Injectable()
export class EmailService {
  constructor() {}

  async sendEmail(
    to: string,
    subject: string,
    content: string,
    isHtml: boolean = true,
  ): Promise<boolean> {
    // For demo purposes, we'll just log the email
    // In production, integrate with services like SendGrid, AWS SES, etc.
    console.log('📧 EMAIL SENT:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Content: ${content.substring(0, 100)}...`);
    
    // Simulate email delivery
    return Promise.resolve(true);
  }

  generateEmailContent(
    type: NotificationType,
    data: any,
    userEmail: string,
  ): { subject: string; content: string } {
    const templates = this.getEmailTemplates();
    const template = templates[type] || templates.default;
    
    const subject = this.replaceTemplateVariables(template.subject, data);
    const content = this.replaceTemplateVariables(template.content, {
      ...data,
      userEmail,
    });

    return { subject, content };
  }

  private getEmailTemplates(): Record<string, { subject: string; content: string }> {
    return {
      [NotificationType.ASSEMBLY_CREATED]: {
        subject: 'Nueva Asamblea Programada: {title}',
        content: `
          <h2>Nueva Asamblea Programada</h2>
          <p>Estimado/a {userName},</p>
          <p>Se ha programado una nueva asamblea:</p>
          <ul>
            <li><strong>Título:</strong> {title}</li>
            <li><strong>Fecha:</strong> {date}</li>
            <li><strong>Ubicación:</strong> {location}</li>
          </ul>
          <p>Descripción: {description}</p>
          <p>Por favor, asegúrese de asistir puntualmente.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.ASSEMBLY_REMINDER]: {
        subject: 'Recordatorio: Asamblea {title} - {date}',
        content: `
          <h2>Recordatorio de Asamblea</h2>
          <p>Estimado/a {userName},</p>
          <p>Le recordamos que la asamblea "{title}" se realizará {reminderTime}.</p>
          <p><strong>Fecha:</strong> {date}</p>
          <p><strong>Ubicación:</strong> {location}</p>
          <p>Su participación es importante para el funcionamiento del condominio.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.VOTING_STARTED]: {
        subject: 'Votación Iniciada: {title}',
        content: `
          <h2>Nueva Votación Disponible</h2>
          <p>Estimado/a {userName},</p>
          <p>Se ha iniciado una nueva votación:</p>
          <p><strong>Título:</strong> {title}</p>
          <p><strong>Descripción:</strong> {description}</p>
          <p><strong>Fecha límite:</strong> {endDate}</p>
          <p>Por favor, ingrese al sistema para emitir su voto.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.VOTING_ENDED]: {
        subject: 'Resultados de Votación: {title}',
        content: `
          <h2>Votación Finalizada</h2>
          <p>Estimado/a {userName},</p>
          <p>Ha finalizado la votación "{title}".</p>
          <p><strong>Resultado:</strong> {result}</p>
          <p><strong>Total de votos:</strong> {totalVotes}</p>
          <p>Puede consultar los resultados detallados en el sistema.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.PROPOSAL_APPROVED]: {
        subject: 'Propuesta Aprobada: {title}',
        content: `
          <h2>Propuesta Aprobada</h2>
          <p>Estimado/a {userName},</p>
          <p>Su propuesta "{title}" ha sido aprobada.</p>
          <p>Se procederá con los siguientes pasos según lo establecido.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.PROPOSAL_REJECTED]: {
        subject: 'Propuesta Rechazada: {title}',
        content: `
          <h2>Propuesta Rechazada</h2>
          <p>Estimado/a {userName},</p>
          <p>Lamentamos informarle que su propuesta "{title}" ha sido rechazada.</p>
          <p>Motivo: {reason}</p>
          <p>Puede contactar a la administración para más información.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.PROJECT_COMPLETED]: {
        subject: 'Proyecto Completado: {title}',
        content: `
          <h2>Proyecto Completado</h2>
          <p>Estimado/a {userName},</p>
          <p>El proyecto "{title}" ha sido completado exitosamente.</p>
          <p><strong>Presupuesto:</strong> {budget}</p>
          <p><strong>Fecha de finalización:</strong> {completedDate}</p>
          <p>Gracias por su apoyo durante el desarrollo del proyecto.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.BUDGET_EXCEEDED]: {
        subject: 'Alerta: Presupuesto Excedido',
        content: `
          <h2>Alerta de Presupuesto</h2>
          <p>Estimado/a {userName},</p>
          <p>Se ha detectado que el presupuesto del año {year} ha sido excedido.</p>
          <p><strong>Presupuesto:</strong> {budgetAmount}</p>
          <p><strong>Gasto actual:</strong> {actualAmount}</p>
          <p><strong>Exceso:</strong> {excessAmount}</p>
          <p>Es necesario revisar los gastos y tomar medidas correctivas.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.MINUTES_PUBLISHED]: {
        subject: 'Acta Publicada: {title}',
        content: `
          <h2>Nueva Acta Disponible</h2>
          <p>Estimado/a {userName},</p>
          <p>Se ha publicado el acta de la asamblea "{title}".</p>
          <p><strong>Fecha de asamblea:</strong> {assemblyDate}</p>
          <p>Puede consultar el acta completa en el sistema.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      [NotificationType.PAYMENT_REMINDER]: {
        subject: 'Recordatorio de Pago - Mes {month}',
        content: `
          <h2>Recordatorio de Pago</h2>
          <p>Estimado/a {userName},</p>
          <p>Le recordamos que tiene un pago pendiente:</p>
          <p><strong>Concepto:</strong> {concept}</p>
          <p><strong>Monto:</strong> {amount}</p>
          <p><strong>Fecha límite:</strong> {dueDate}</p>
          <p>Por favor, realice el pago a la brevedad para evitar recargos.</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
      default: {
        subject: 'Notificación del Sistema',
        content: `
          <h2>Notificación</h2>
          <p>Estimado/a {userName},</p>
          <p>{message}</p>
          <p>Saludos cordiales,<br>Administración del Condominio</p>
        `,
      },
    };
  }

  private replaceTemplateVariables(template: string, data: any): string {
    let result = template;
    
    // Replace all {variable} patterns with actual data
    const matches = result.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(match => {
        const key = match.slice(1, -1); // Remove { and }
        if (data[key] !== undefined) {
          result = result.replace(match, data[key]);
        }
      });
    }
    
    return result;
  }
}
