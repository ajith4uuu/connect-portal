import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export interface ExtractedData {
  province?: string;
  age?: string;
  stage?: string;
  ERPR?: string;
  HER2?: string;
  BRCA?: string;
  luminal?: string;
  PIK3CA?: string;
  ESR1?: string;
  PDL1?: string;
  MSI?: string;
  Ki67?: string;
  PTEN?: string;
  AKT1?: string;
  filesProcessed?: number;
}

export interface UploadResult {
  success: boolean;
  extracted: ExtractedData;
  filesProcessed: number;
  message: string;
}

class UploadService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  async analyzeFiles(files: File[]): Promise<ExtractedData> {
    try {
      const formData = new FormData();
      
      files.forEach((file, index) => {
        formData.append('files', file);
      });

      const response = await this.api.post('/upload/analyze', formData);
      return response.data.extracted;
    } catch (error) {
      console.error('Error analyzing files:', error);
      throw error;
    }
  }

  async uploadFiles(files: File[]): Promise<any> {
    try {
      const formData = new FormData();
      
      files.forEach((file, index) => {
        formData.append('files', file);
      });

      const response = await this.api.post('/upload/upload', formData);
      return response.data;
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    }
  }

  async processGCSFiles(gcsUris: string[], language: string = 'en'): Promise<ExtractedData> {
    try {
      const response = await this.api.post('/upload/process-gcs', {
        gcsUris,
        lang: language
      });
      return response.data.extracted;
    } catch (error) {
      console.error('Error processing GCS files:', error);
      throw error;
    }
  }
}

export const uploadService = new UploadService();