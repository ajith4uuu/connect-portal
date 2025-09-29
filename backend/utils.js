const translations = require('./translations');

// PDF mapping data
const PDF_MAPPING = {
  'DCIS / Stage 0': 'https://drive.google.com/file/d/1SNem7t-VJf-q31D-NuJJHNY08Jdf1k_z/view?usp=drive_link',
  'Stage I': 'https://drive.google.com/file/d/1v45G7eO1PfleAo10eY5GfZ8NVqJmVor_/view?usp=drive_link',
  'Stage II': 'https://drive.google.com/file/d/1sv8_QGiwmLTVpU8u1HyXmHFPV0HBVqsV/view?usp=drive_link',
  'Stage III': 'https://drive.google.com/file/d/10JZ1MVfukIphQovbhEEZ1eGCNNBTEWb7/view?usp=drive_link',
  'Stage IV': 'https://drive.google.com/file/d/1i6I7SRjobdZScTj2-tAFLQwBOsAImSez/view?usp=drive_link',
  'Stage II ER+/PR+/HER2+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage II ER+/PR+/HER2 Low': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage II ER+/PR+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage II BRCA+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage II HER-2+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage II TNBC': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage III ER+/PR+/HER2+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage III ER+/PR+/HER2 Low': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage III ER+/PR+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage III BRCA+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage III HER-2+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage III TNBC': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage IV ER/PR+/HER2+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage IV ER/PR+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage IV HER-2+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view',
  'Stage IV BRCA+': 'https://drive.google.com/file/d/1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/view'
};

function extractDataFromText(txt) {
  const t = translations.en; // Always extract in English
  
  function rx(re) { 
    const m = txt.match(re); 
    return m && m[1] ? m[1].trim() : t.not_available; 
  }
  
  // AGE EXTRACTION
  let age = t.not_available;
  const ageMatch = txt.match(/\bAge\s*[:\-]?\s*(\d+)\b/i) || 
                  txt.match(/\bDOB\b.*?(\d{2,4})\b/i) || 
                  txt.match(/\bDate\s*of\s*Birth\b.*?(\d{2,4})\b/i);
  if (ageMatch && ageMatch[1]) {
    const currentYear = new Date().getFullYear();
    const year = parseInt(ageMatch[1]);
    age = (year > 1900 && year <= currentYear) ? 
          (currentYear - year).toString() : 
          year.toString();
  } 
  
  // PROVINCE EXTRACTION
  let province = t.not_available;
  const provincePatterns = [
    /Province[:\s-]*([A-Z]{2})/i,
    /Province\/State[:\s-]*(\w+)/i,
    /Location[:\s-]*(\w+\s?\w+)/i,
    /(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)/i,
    /(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)/i
  ];
  
  for (const pattern of provincePatterns) {
    const match = txt.match(pattern);
    if (match) {
      province = match[1];
      break;
    }
  }
  
  // COUNTRY EXTRACTION
  let country = t.not_available;
  const countryPatterns = [
    /Country[:\s-]*(Canada|United States|USA|US)\b/i,
    /(Canada|United States|USA|US)\b.*?(resident|patient|citizen)/i
  ];
  
  for (const pattern of countryPatterns) {
    const match = txt.match(pattern);
    if (match) {
      const countryStr = match[1];
      if (countryStr.match(/canada/i)) {
        country = 'Canada';
      } else if (countryStr.match(/united states|usa|us/i)) {
        country = 'United States';
      }
      break;
    }
  }
  
  // STAGE EXTRACTION
  let stage = t.not_available;
  const stagePatterns = [
    /Stage\s*[:\s-]*([0IV]+)/i,
    /Stage\s*([0IV]+)/i,
    /(Stage\s*[0-9IV]+)/i,
    /(DCIS|Stage 0|Stage I|Stage II|Stage III|Stage IV)/i,
    /TNM.*?[pT][0-4].*?[pN][0-3].*?[M][01]/i
  ];
  
  for (const pattern of stagePatterns) {
    const match = txt.match(pattern);
    if (match) {
      stage = match[1].replace(/\s/g, '');
      break;
    }
  }
  
  // Convert to consistent stage format
  if (stage !== t.not_available) {
    const stageMap = {
      '0': 'DCIS / Stage 0',
      'I': 'Stage I',
      'II': 'Stage II',
      'III': 'Stage III',
      'IV': 'Stage IV',
      'DCIS': 'DCIS / Stage 0'
    };
    stage = stageMap[stage] || stage;
  }
  
  // ER/PR EXTRACTION
  let ERPR = t.not_available;
  const erTests = [
    /(Estrogen|ER)[-\s]*(receptor)?[:\s-]*(Positive|Negative|Pos|Neg|Reactive|Non[- ]reactive)/i,
    /ER[:\s-]*(Positive|Negative|Pos|Neg|\+|\-)/i
  ];
  const prTests = [
    /(Progesterone|PR)[-\s]*(receptor)?[:\s-]*(Positive|Negative|Pos|Neg|Reactive|Non[- ]reactive)/i,
    /PR[:\s-]*(Positive|Negative|Pos|Neg|\+|\-)/i
  ];
  
  let erPos = null, prPos = null;
  for (const re of erTests) {
    const m = txt.match(re);
    if (m) {
      erPos = /pos|reactive|\+/i.test(m[3] || m[1]);
      break;
    }
  }
  for (const re of prTests) {
    const m = txt.match(re);
    if (m) {
      prPos = /pos|reactive|\+/i.test(m[3] || m[1]);
      break;
    }
  }
  
  if (erPos !== null && prPos !== null) {
    ERPR = `${erPos ? 'ER+' : 'ER–'} & ${prPos ? 'PR+' : 'PR–'}`;
  }

  // HER2 EXTRACTION
  let HER2 = t.not_available;
  const her2Patterns = [
    /HER[-]?2[^\d]*(?:IHC)?[^\d]*(0|1\+|2\+|3\+)[^\w]/i,
    /HER[-]?2[^:]*[:\-]?\s*(Positive|Negative|Equivocal|Overexpression|Amplified|Low|High)/i,
    /HER[-]?2\/neu[^:]*[:\-]?\s*(Positive|Negative|Equivocal|\+|\-)/i,
    /HER[-]?2.*?Score[:\s]*(\d\+?)/i
  ];
  
  for (const pattern of her2Patterns) {
    const match = txt.match(pattern);
    if (match) {
      const value = match[1];
      if (value === '0' || /negative|\-/i.test(value)) {
        HER2 = 'HER-2 Negative (0)';
      } else if (value === '1+' || value === '2+' || /equivocal|low/i.test(value)) {
        HER2 = 'HER-2 Low (1+ or 2+)';
      } else if (value === '3+' || /positive|overexpression|amplified|high|\+/i.test(value)) {
        HER2 = 'HER-2 High (3+)';
      }
      if (HER2 !== t.not_available) break;
    }
  }

  // LUMINAL SUBTYPE
  let luminal = t.not_available;
  const luminalPatterns = [
    /Luminal\s*(?:subtype|type)?[:\s]*(A|B)/i,
    /Luminal\s*[AB]/i,
    /(Luminal A|Luminal B)/i,
    /Molecular subtype[:\s]*(Luminal [AB])/i
  ];
  
  for (const pattern of luminalPatterns) {
    const match = txt.match(pattern);
    if (match) {
      if (match[1]) {
        luminal = match[1].includes('A') ? 'Luminal A' : 'Luminal B';
      }
      break;
    }
  }

  // BRCA EXTRACTION
  let BRCA = t.not_available;
  const brcaPatterns = [
    /BRCA[12][:\s-]*(Positive|Negative|Mutation|Wild[-\s]?type|Not\s+tested|\+|\-)/i,
    /BRCA[:\s-]*(1|2)[:\s-]*(Positive|Negative|Mutation|Wild[-\s]?type|\+|\-)/i,
    /Genetic.*?BRCA[12]?[:\s-]*(Positive|Negative|Mutation|Present|Absent)/i
  ];
  
  for (const pattern of brcaPatterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/positive|mutation|present|\+/i.test(match[1] || match[2])) {
        if (txt.includes('BRCA1')) BRCA = 'BRCA1+';
        else if (txt.includes('BRCA2')) BRCA = 'BRCA2+';
        else BRCA = 'BRCA+';
      } else if (/negative|wild|absent|\-/i.test(match[1] || match[2])) {
        BRCA = 'Negative';
      } else if (/not\s+tested/i.test(match[1] || match[2])) {
        BRCA = 'Not tested';
      }
      break;
    }
  }

  // PIK3CA EXTRACTION
  let PIK3CA = t.not_available;
  const pik3caPatterns = [
    /PIK3CA[:\s-]*(Positive|Negative|Mutation|Wild[-\s]?type|Not\s+tested|\+|\-)/i,
    /PIK3CA.*?(detected|not detected|present|absent)/i
  ];
  
  for (const pattern of pik3caPatterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/positive|mutation|detected|present|\+/i.test(match[1])) {
        PIK3CA = 'Positive';
      } else if (/negative|wild|not detected|absent|\-/i.test(match[1])) {
        PIK3CA = 'Negative';
      } else if (/not\s+tested/i.test(match[1])) {
        PIK3CA = 'Not tested';
      }
      break;
    }
  }

  // ESR1 EXTRACTION
  let ESR1 = t.not_available;
  const esr1Patterns = [
    /ESR1[:\s-]*(Positive|Negative|Mutation|Wild[-\s]?type|Not\s+tested|\+|\-)/i,
    /ESR1.*?(detected|not detected|present|absent)/i
  ];
  
  for (const pattern of esr1Patterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/positive|mutation|detected|present|\+/i.test(match[1])) {
        ESR1 = 'Positive';
      } else if (/negative|wild|not detected|absent|\-/i.test(match[1])) {
        ESR1 = 'Negative';
      } else if (/not\s+tested/i.test(match[1])) {
        ESR1 = 'Not tested';
      }
      break;
    }
  }
  
  // PD-L1 EXTRACTION
  let PDL1 = t.not_available;
  const pdl1Patterns = [
    /PD[-]?L1[:\s-]*(High|Low|Positive|Negative|Expression|CPS\s*[<>=]\s*\d+)/i,
    /Programmed Death Ligand 1[:\s-]*(High|Low|Positive|Negative)/i,
    /PD[-]?L1.*?(\d+)%/i,
    /CPS\s*[:\s]?\s*(\d+)/i
  ];
  
  for (const pattern of pdl1Patterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/high|positive/i.test(match[1]) || (match[1] && parseInt(match[1]) >= 10)) {
        PDL1 = 'High expression';
      } else if (/low|negative/i.test(match[1]) || (match[1] && parseInt(match[1]) < 10)) {
        PDL1 = 'Low expression';
      }
      if (PDL1 !== t.not_available) break;
    }
  }

  // MSI EXTRACTION
  let MSI = t.not_available;
  const msiPatterns = [
    /MSI[:\s-]*(High|Low|Stable|Instability|MSI-H|MSI-L|MSS)/i,
    /Microsatellite[:\s-]*(High|Low|Stable|Instability)/i,
    /MMR[:\s-]*(Deficient|Proficient|dMMR|pMMR)/i
  ];
  
  for (const pattern of msiPatterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/high|MSI-H|deficient|dMMR/i.test(match[1])) {
        MSI = 'MSI-High';
      } else if (/low|MSI-L|stable|MSS|proficient|pMMR/i.test(match[1])) {
        MSI = 'MSI-Low';
      }
      if (MSI !== t.not_available) break;
    }
  }
  
  // Ki-67 EXTRACTION
  let Ki67 = t.not_available;
  const ki67Patterns = [
    /Ki[-]?67[:\s-]*(\d+)%?/i,
    /Ki[-]?67.*?(High|Low|Positive|Negative)/i,
    /Proliferation.*?Ki[-]?67[:\s-]*(\d+)%?/i
  ];
  
  for (const pattern of ki67Patterns) {
    const match = txt.match(pattern);
    if (match) {
      if (match[1]) {
        const value = parseInt(match[1]);
        if (!isNaN(value)) {
          Ki67 = value >= 20 ? 'High (≥20%)' : 'Low (<20%)';
        } else if (/high/i.test(match[1])) {
          Ki67 = 'High (≥20%)';
        } else if (/low/i.test(match[1])) {
          Ki67 = 'Low (<20%)';
        }
      }
      if (Ki67 !== t.not_available) break;
    }
  }
  
  // PTEN EXTRACTION
  let PTEN = t.not_available;
  const ptenPatterns = [
    /PTEN[:\s-]*(Positive|Negative|Loss|Retained|Not\s+tested|\+|\-)/i,
    /PTEN.*?(detected|not detected|present|absent|loss)/i
  ];
  
  for (const pattern of ptenPatterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/positive|retained|present|\+/i.test(match[1])) {
        PTEN = 'Positive';
      } else if (/negative|loss|not detected|absent|\-/i.test(match[1])) {
        PTEN = 'Negative';
      } else if (/not\s+tested/i.test(match[1])) {
        PTEN = 'Not tested';
      }
      break;
    }
  }
  
  // AKT1 EXTRACTION
  let AKT1 = t.not_available;
  const akt1Patterns = [
    /AKT1[:\s-]*(Positive|Negative|Mutation|Wild[-\s]?type|Not\s+tested|\+|\-)/i,
    /AKT1.*?(detected|not detected|present|absent)/i
  ];
  
  for (const pattern of akt1Patterns) {
    const match = txt.match(pattern);
    if (match) {
      if (/positive|mutation|detected|present|\+/i.test(match[1])) {
        AKT1 = 'Mutation detected';
      } else if (/negative|wild|not detected|absent|\-/i.test(match[1])) {
        AKT1 = 'Negative';
      } else if (/not\s+tested/i.test(match[1])) {
        AKT1 = 'Not tested';
      }
      break;
    }
  }

  return {
    province,
    country,
    age,
    stage,
    ERPR,
    HER2,
    luminal,
    BRCA,
    PIK3CA,
    ESR1,
    PDL1,
    MSI,
    Ki67,
    PTEN,
    AKT1
  };
}

function calculateStageFromBiomarkers(data) {
  const erPos = data.ERPR && data.ERPR.includes('ER+');
  const prPos = data.ERPR && data.ERPR.includes('PR+');
  const her2High = data.HER2 && data.HER2.includes('(3+)');
  const her2Low = data.HER2 && data.HER2.includes('(1+ or 2+)');
  const brcaPos = data.BRCA && (data.BRCA.includes('BRCA1+') || data.BRCA.includes('BRCA2+'));
  
  // Advanced stage calculation based on biomarkers
  if (erPos && her2High) return 'Stage II ER+/PR+/HER2+';
  if (erPos && her2Low) return 'Stage II ER+/PR+/HER2 Low';
  if (erPos && !her2High && !her2Low) return 'Stage II ER+/PR+';
  if (brcaPos) return 'Stage II BRCA+';
  if (her2High) return 'Stage II HER-2+';
  if (!erPos && !prPos && !her2High) return 'Stage II TNBC';
  
  return 'Stage II';
}

function computePackages(userStage, resp) {
  const pkgs = [];
  
  if (userStage.includes('Stage IV')) {
    if (userStage.includes('ER+/PR+') && userStage.includes('HER2+')) {
      pkgs.push('Stage IV ER/PR+/HER2+ package');
    }
    else if (userStage.includes('ER+/PR+') && !userStage.includes('HER2+')) {
      pkgs.push('Stage IV ER/PR+ package');
    } 
    else if (userStage.includes('HER-2+') && !userStage.includes('ER+/PR+')) {
      pkgs.push('Stage IV HER-2+ package');
    } 
    else if (resp.BRCA && (resp.BRCA.includes('BRCA1+') || resp.BRCA.includes('BRCA2+'))) {
      pkgs.push('Stage IV BRCA+ package');
    } 
    else {
      pkgs.push('Core package for Stage IV');
    }
  } 
  else if (userStage.includes('Stage III')) {
    if (userStage.includes('BRCA+')) {
      pkgs.push('Stage III BRCA+ package');
    } 
    else if (userStage.includes('ER+/PR+/HER2+')) {
      pkgs.push('Stage III ER/PR+/HER2+ package');
    } 
    else if (userStage.includes('HER-2+')) {
      pkgs.push('Stage III HER-2+ package');
    } 
    else if (userStage.includes('ER+/PR+')) {
      pkgs.push('Stage III ER/PR+ package');
    }
    else if (userStage.includes('ER+/PR+/HER2 Low')) {
      pkgs.push('Stage III ER/PR+/HER2 Low package');
    }
    else {
      pkgs.push('Core package for Stage III (TNBC)');
    }
  } 
  else if (userStage.includes('Stage II')) {
    if (userStage.includes('BRCA+')) {
      pkgs.push('Stage II BRCA+ package');
    } 
    else if (userStage.includes('ER+/PR+/HER2+')) {
      pkgs.push('Stage II ER/PR+/HER2+ package');
    } 
    else if (userStage.includes('HER-2+')) {
      pkgs.push('Stage II HER-2+ package');
    } 
    else if (userStage.includes('ER+/PR+')) {
      pkgs.push('Stage II ER/PR+ package');
    }
    else if (userStage.includes('ER+/PR+/HER2 Low')) {
      pkgs.push('Stage II ER/PR+/HER2 Low package');
    }
    else {
      pkgs.push('Core package for Stage II (TNBC)');
    }
  } 
  else if (userStage.includes('Stage I')) {
    pkgs.push('Core package for Stage I');
  } 
  else if (userStage.includes('Stage 0') || userStage.includes('DCIS')) {
    pkgs.push('Core package for DCIS / Stage 0');
  }
  
  // Add targeted therapies based on biomarkers
  if (resp.BRCA && resp.BRCA.includes('+')) {
    pkgs.push('PARP inhibitors');
  }
  if (resp.HER2 && resp.HER2.includes('(3+)')) {
    pkgs.push('HER2-targeted therapy');
  }
  if (resp.PIK3CA && /Positive/i.test(resp.PIK3CA)) {
    pkgs.push('PIK3CA-Targeted Therapy');
  }
  if (resp.ESR1 && /Positive/i.test(resp.ESR1)) {
    pkgs.push('ESR1-Targeted Therapy');
  }
  if (resp.PDL1 && /High/i.test(resp.PDL1)) {
    pkgs.push('PD-L1 Immunotherapy');
  }
  if (resp.MSI && /High/i.test(resp.MSI)) {
    pkgs.push('MSI-High Targeted Therapy');
  }
  if (resp.AKT1 && /Mutation/i.test(resp.AKT1)) {
    pkgs.push('AKT1 Inhibitors');
  }
  
  return pkgs;
}

function getPdfLink(userStage, resp) {
  // Try direct mapping first
  if (PDF_MAPPING[userStage]) {
    return PDF_MAPPING[userStage];
  }
  
  // Advanced matching based on biomarkers for compound stages
  const erPos = resp.ERPR?.includes('ER+');
  const prPos = resp.ERPR?.includes('PR+');
  const her2High = resp.HER2?.includes('(3+)');
  const her2Low = resp.HER2?.includes('(1+ or 2+)');
  const brcaPos = resp.BRCA?.includes('+');
  
  // Build key based on stage and biomarkers
  const baseStage = userStage.split(' ').slice(0, 2).join(' '); // Get "Stage X"
  
  if (baseStage === 'Stage II' || baseStage === 'Stage III' || baseStage === 'Stage IV') {
    if (erPos && prPos && her2High) {
      const key = `${baseStage} ER+/PR+/HER2+`;
      if (PDF_MAPPING[key]) return PDF_MAPPING[key];
    }
    if (erPos && prPos && her2Low) {
      const key = `${baseStage} ER+/PR+/HER2 Low`;
      if (PDF_MAPPING[key]) return PDF_MAPPING[key];
    }
    if (erPos && prPos && !her2High && !her2Low) {
      const key = `${baseStage} ER+/PR+`;
      if (PDF_MAPPING[key]) return PDF_MAPPING[key];
    }
    if (her2High && !erPos && !prPos) {
      const key = `${baseStage} HER-2+`;
      if (PDF_MAPPING[key]) return PDF_MAPPING[key];
    }
    if (brcaPos) {
      const key = `${baseStage} BRCA+`;
      if (PDF_MAPPING[key]) return PDF_MAPPING[key];
    }
    if (!erPos && !prPos && !her2High) {
      const key = `${baseStage} TNBC`;
      if (PDF_MAPPING[key]) return PDF_MAPPING[key];
    }
  }
  
  // Fallback to base stage
  return PDF_MAPPING[baseStage] || '';
}

module.exports = {
  extractDataFromText,
  calculateStageFromBiomarkers,
  computePackages,
  getPdfLink
};
