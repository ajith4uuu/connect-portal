const { GoogleGenerativeAI } = require('@google/generative-ai');
const winston = require('winston');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'gemini.log' })
      ]
    });
    
    this.initialize();
  }

  initialize() {
    if (this.apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        this.logger.info('Gemini service initialized successfully');
      } catch (error) {
        this.logger.error('Error initializing Gemini service:', error);
      }
    } else {
      this.logger.warn('Gemini API key not provided. AI summaries will not be generated.');
    }
  }

  async generateSummary(userStage, answers, packages, lang = 'en') {
    if (!this.model) {
      return this.getFallbackSummary(userStage, packages, lang);
    }

    try {
      const prompt = this.buildPrompt(userStage, answers, packages, lang);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      this.logger.info('AI summary generated successfully');
      return text;
    } catch (error) {
      this.logger.error('Error generating AI summary:', error);
      return this.getFallbackSummary(userStage, packages, lang);
    }
  }

  buildPrompt(userStage, answers, packages, lang) {
    const translations = this.getTranslations(lang);
    
    let pathologyData = `
${translations.gender}: ${answers.gender || 'Not specified'}
${translations.age}: ${answers.age || 'Not specified'}
${translations.country}: ${answers.country || 'Not specified'}
${translations.province}: ${answers.province || 'Not specified'}

${translations.selected_stage}: ${userStage}
${translations.year_of_diagnosis}: ${answers.year || 'Not specified'}
${translations.lymph_nodes}: ${answers.lymphNodes || 'Not specified'}
${translations.laterality}: ${answers.laterality || 'Not specified'}
${translations.dense_breasts}: ${answers.denseBreasts || 'Not specified'}

${translations.erpr_status}: ${answers.ERPR || 'Not tested'}
${translations.her2_status}: ${answers.HER2 || 'Not tested'}
${translations.brca_status}: ${answers.BRCA || 'Not tested'}
${translations.pik3ca_status}: ${answers.PIK3CA || 'Not tested'}
${translations.esr1_status}: ${answers.ESR1 || 'Not tested'}
${translations.pdl1_status}: ${answers.PDL1 || 'Not tested'}
${translations.msi_status}: ${answers.MSI || 'Not tested'}
${translations.ki67_status}: ${answers.Ki67 || 'Not tested'}
${translations.pten_status}: ${answers.PTEN || 'Not tested'}
${translations.akt1_status}: ${answers.AKT1 || 'Not tested'}`;

    if (answers.spread) {
      const spreadText = Array.isArray(answers.spread) 
        ? answers.spread.join(', ') 
        : answers.spread;
      pathologyData += `\n${translations.spread_locations}: ${spreadText}`;
    }

    return `${translations.summary_intro}

${translations.bcc_packages}: ${packages.join(', ')}

${translations.patient_data_intro}:
${pathologyData}

${translations.generate_summary_instruction}`;
  }

  getFallbackSummary(userStage, packages, lang) {
    const translations = this.getTranslations(lang);
    
    return `${translations.fallback_intro}

${translations.your_stage}: ${userStage}
${translations.recommended_treatments}: ${packages.join(', ')}

${translations.consultation_advice}

${translations.additional_notes}`;
  }

  getTranslations(lang) {
    const translations = {
      en: {
        gender: 'Gender',
        age: 'Age at diagnosis',
        country: 'Country',
        province: 'Province/State',
        selected_stage: 'Selected Stage',
        year_of_diagnosis: 'Year of diagnosis',
        lymph_nodes: 'Lymph nodes',
        laterality: 'Breast affected',
        dense_breasts: 'Dense breasts',
        erpr_status: 'ER/PR Status',
        her2_status: 'HER2 Status',
        brca_status: 'BRCA Status',
        pik3ca_status: 'PIK3CA Status',
        esr1_status: 'ESR1 Status',
        pdl1_status: 'PD-L1 Status',
        msi_status: 'MSI Status',
        ki67_status: 'Ki-67 Status',
        pten_status: 'PTEN Status',
        akt1_status: 'AKT1 Status',
        spread_locations: 'Spread locations',
        summary_intro: 'Generate a comprehensive, personalized treatment summary for a breast cancer patient based on the following information:',
        bcc_packages: 'BCC Recommended Packages',
        patient_data_intro: 'Patient Data',
        generate_summary_instruction: `Please provide a detailed, easy-to-understand summary that includes:
1. An overview of the patient's specific cancer type and stage
2. Explanation of the biomarker results and their significance
3. Recommended treatment approaches based on the packages
4. Key points for discussion with their healthcare team
5. Important next steps and considerations

Use clear, compassionate language appropriate for patients and families. Format the response with clear sections and bullet points for easy reading.`,
        fallback_intro: 'Based on your survey responses and uploaded pathology reports, here is your personalized treatment summary:',
        your_stage: 'Your Cancer Stage',
        recommended_treatments: 'Recommended Treatment Approaches',
        consultation_advice: 'Please discuss these recommendations with your healthcare team to develop the most appropriate treatment plan for your specific situation.',
        additional_notes: 'Note: This summary is based on current evidence-based guidelines and your specific biomarker profile. Your healthcare team may recommend additional treatments or clinical trials not reflected here.'
      },
      fr: {
        gender: 'Sexe',
        age: 'Âge au diagnostic',
        country: 'Pays',
        province: 'Province/État',
        selected_stage: 'Stade sélectionné',
        year_of_diagnosis: 'Année de diagnostic',
        lymph_nodes: 'Ganglions lymphatiques',
        laterality: 'Sein affecté',
        dense_breasts: 'Seins denses',
        erpr_status: 'Statut ER/PR',
        her2_status: 'Statut HER2',
        brca_status: 'Statut BRCA',
        pik3ca_status: 'Statut PIK3CA',
        esr1_status: 'Statut ESR1',
        pdl1_status: 'Statut PD-L1',
        msi_status: 'Statut MSI',
        ki67_status: 'Statut Ki-67',
        pten_status: 'Statut PTEN',
        akt1_status: 'Statut AKT1',
        spread_locations: 'Sites de propagation',
        summary_intro: 'Générez un résumé de traitement personnalisé et complet pour une patiente atteinte d\'un cancer du sein basé sur les informations suivantes:',
        bcc_packages: 'Ensembles de recommandations BCC',
        patient_data_intro: 'Données du patient',
        generate_summary_instruction: `Veuillez fournir un résumé détaillé et facile à comprendre qui inclut:
1. Un aperçu du type et du stade spécifiques du cancer de la patiente
2. Explication des résultats des biomarqueurs et leur signification
3. Approches thérapeutiques recommandées basées sur les ensembles
4. Points clés pour la discussion avec leur équipe soignante
5. Prochaines étapes et considérations importantes

Utilisez un langage clair et compatissant approprié pour les patients et les familles. Formatez la réponse avec des sections claires et des points de puce pour une lecture facile.`,
        fallback_intro: 'Basé sur vos réponses à l\'enquête et les rapports de pathologie téléchargés, voici votre résumé de traitement personnalisé:',
        your_stage: 'Votre stade de cancer',
        recommended_treatments: 'Approches thérapeutiques recommandées',
        consultation_advice: 'Veuillez discuter de ces recommandations avec votre équipe soignante pour développer le plan de traitement le plus approprié pour votre situation spécifique.',
        additional_notes: 'Remarque: Ce résumé est basé sur les lignes directrices fondées sur les preuves actuelles et votre profil de biomarqueurs spécifique. Votre équipe soignante peut recommander des traitements supplémentaires ou des essais cliniques non reflétés ici.'
      }
    };
    
    return translations[lang] || translations.en;
  }
}

module.exports = GeminiService;