import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export interface SurveyData {
  answers: {
    [key: string]: any;
  };
  extracted?: {
    [key: string]: any;
  };
  language?: string;
}

export interface SurveyResult {
  success: boolean;
  userStage: string;
  calculatedStage: string;
  packages: string[];
  pdfUrl?: string;
  summary?: string;
  surveyId?: string;
}

class SurveyService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async getSurveyQuestions(stage: string, language: string = 'en') {
    try {
      const response = await this.api.get(`/survey/questions/${stage}`, {
        params: { lang: language }
      });
      return response.data.questions;
    } catch (error) {
      console.error('Error fetching survey questions:', error);
      throw error;
    }
  }

  async submitSurvey(data: SurveyData): Promise<SurveyResult> {
    try {
      const response = await this.api.post('/survey/submit', data);
      return response.data;
    } catch (error) {
      console.error('Error submitting survey:', error);
      throw error;
    }
  }

  async getSurveyById(surveyId: string) {
    try {
      const response = await this.api.get(`/survey/survey/${surveyId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching survey:', error);
      throw error;
    }
  }

  async getAnalytics() {
    try {
      const response = await this.api.get('/survey/analytics');
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  }
}

export const surveyService = new SurveyService();