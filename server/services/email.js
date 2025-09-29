const nodemailer = require('nodemailer');
const winston = require('winston');

class EmailService {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'email.log' })
      ]
    });
    
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // For production, use Gmail SMTP or SendGrid
      if (process.env.NODE_ENV === 'production') {
        this.transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
      } else {
        // For development, use ethereal.email
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransporter({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      }
      
      // Verify connection configuration
      await this.transporter.verify();
      this.logger.info('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing email transporter:', error);
      throw error;
    }
  }

  async sendSurveyConfirmation(email, surveyData, resultData, lang = 'en') {
    try {
      const { t } = this.getTranslations(lang);
      
      const subject = `${t('email_subject')} - ${resultData.userStage}`;
      
      const htmlContent = this.generateEmailHTML(surveyData, resultData, lang);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@progressconnect.ca',
        to: email,
        subject: subject,
        html: htmlContent,
        text: this.generateEmailText(surveyData, resultData, lang)
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.info(`Email sent successfully to ${email}: ${info.messageId}`);
      
      if (process.env.NODE_ENV !== 'production') {
        this.logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
      
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info)
      };
    } catch (error) {
      this.logger.error(`Error sending email to ${email}:`, error);
      throw error;
    }
  }

  generateEmailHTML(surveyData, resultData, lang) {
    const { t } = this.getTranslations(lang);
    
    return `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t('email_subject')}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e5317a; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
          .section { margin-bottom: 20px; }
          .section h3 { color: #0e3b33; margin-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .info-item { background: white; padding: 10px; border-radius: 5px; border-left: 4px solid #53868b; }
          .info-label { font-weight: bold; color: #0e3b33; }
          .download-btn { 
            display: inline-block; 
            background: #53868b; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 30px; 
            margin-top: 10px;
            transition: all 0.3s ease;
          }
          .download-btn:hover { background: #3d6c6d; transform: translateY(-2px); }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px; }
          .warning h4 { color: #856404; margin-top: 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${t('app_title')}</h1>
            <h2>${t('treatment_summary')}</h2>
          </div>
          
          <div class="content">
            <div class="section">
              <h3>${t('hello')} ${surveyData.email || 'Patient'}</h3>
              <p>${t('submission_received')}</p>
            </div>
            
            <div class="section">
              <h3>${t('selected_stage')}</h3>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">${t('selected_stage')}</div>
                  <div>${resultData.userStage}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">${t('calculated_stage')}</div>
                  <div>${resultData.calculatedStage}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">${t('bcc_package')}</div>
                  <div>${resultData.packages}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">${t('age_label')}</div>
                  <div>${surveyData.age || 'Not provided'}</div>
                </div>
              </div>
            </div>
            
            ${resultData.pdfUrl ? `
            <div class="section">
              <h3>${t('download_btn')}</h3>
              <p>Your personalized treatment recommendations are available for download:</p>
              <a href="${resultData.pdfUrl}" class="download-btn" target="_blank">
                ${t('download_btn')}
              </a>
            </div>
            ` : ''}
            
            ${resultData.geminiSummary ? `
            <div class="section">
              <h3>${t('ai_summary')}</h3>
              <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #e5317a;">
                <p><em>${t('summary_text')}</em></p>
                <div style="margin-top: 10px;">${resultData.geminiSummary.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            ` : ''}
            
            <div class="warning">
              <h4>${t('important_note')}</h4>
              <p>${t('consult_doctor')}</p>
            </div>
            
            <div class="footer">
              <p>${t('best_regards')}<br>
              ${t('team_name')}</p>
              <p style="font-size: 12px; margin-top: 10px;">
                This email was generated automatically. Please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateEmailText(surveyData, resultData, lang) {
    const { t } = this.getTranslations(lang);
    
    let text = `${t('hello')} ${surveyData.email || 'Patient'}\n\n`;
    text += `${t('submission_received')}\n\n`;
    text += `${t('selected_stage')} ${resultData.userStage}\n`;
    text += `${t('calculated_stage')} ${resultData.calculatedStage}\n`;
    text += `${t('bcc_package')} ${resultData.packages}\n\n`;
    
    if (resultData.pdfUrl) {
      text += `${t('download_btn')}: ${resultData.pdfUrl}\n\n`;
    }
    
    if (resultData.geminiSummary) {
      text += `${t('ai_summary')}:\n${t('summary_text')}\n${resultData.geminiSummary}\n\n`;
    }
    
    text += `${t('important_note')}\n${t('consult_doctor')}\n\n`;
    text += `${t('best_regards')}\n${t('team_name')}`;
    
    return text;
  }

  getTranslations(lang) {
    const translations = {
      en: {
        app_title: 'PROgress CONNECT Patient Portal',
        email_subject: 'Your Breast Cancer Treatment Recommendations',
        hello: 'Hello,',
        submission_received: 'Your survey submission has been received and processed.',
        selected_stage: 'Selected Stage:',
        calculated_stage: 'System Calculated Stage:',
        bcc_package: 'BCC Recommended Package:',
        treatment_summary: 'Personalized Treatment Summary',
        download_btn: 'Download Your BCC Recommended Package',
        age_label: 'Age at diagnosis:',
        ai_summary: 'AI-Generated Personalized Summary',
        summary_text: 'This comprehensive summary was generated by Gemini AI based on your uploaded documents and survey responses.',
        important_note: 'Important Note',
        consult_doctor: 'Always consult your healthcare team before making any treatment decisions.',
        best_regards: 'Best regards,',
        team_name: 'The Breast Cancer Canada Team'
      },
      fr: {
        app_title: 'Portail Patient PROgress CONNECT',
        email_subject: 'Vos recommandations de traitement contre le cancer du sein',
        hello: 'Bonjour,',
        submission_received: 'Votre soumission a été reçue et traitée.',
        selected_stage: 'Stade sélectionné:',
        calculated_stage: 'Stade calculé par le système:',
        bcc_package: 'Ensemble de recommandations BCC:',
        treatment_summary: 'Résumé personnalisé du traitement',
        download_btn: 'Télécharger votre ensemble de recommandations BCC',
        age_label: 'Âge au diagnostic:',
        ai_summary: 'Résumé personnalisé généré par l\'IA',
        summary_text: 'Ce résumé complet a été généré par Gemini AI sur la base des documents que vous avez téléchargés et de vos réponses à l\'enquête.',
        important_note: 'Note importante',
        consult_doctor: 'Consultez toujours votre équipe soignante avant de prendre des décisions de traitement.',
        best_regards: 'Cordialement,',
        team_name: 'L\'équipe de Cancer du sein Canada'
      }
    };
    
    return {
      t: (key) => translations[lang]?.[key] || translations.en[key] || key
    };
  }
}

module.exports = EmailService;