import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface KBDocument {
  id: string;
  title: string;
  text: string;
  tags: string[];
  namespace?: string;
}

export interface RetrievalResult {
  docId: string;
  title: string;
  text: string;
  tags: string[];
  score: number;
}

export class RAGService {
  private db = new PrismaClient();
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/embeddings`,
        {
          model: 'openai/text-embedding-3-small',
          input: text
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://auramed.app',
            'X-Title': 'AuraMed Healthcare Platform'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  async indexDocument(doc: KBDocument): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(doc.text);
      
      await (this.db as any).aIKBVector.create({
        data: {
          namespace: doc.namespace || 'global',
          docId: doc.id,
          title: doc.title,
          text: doc.text,
          tags: doc.tags,
          vector: embedding
        }
      });
    } catch (error) {
      logger.error(`Failed to index document ${doc.id}:`, error);
    }
  }

  async indexDocuments(docs: KBDocument[]): Promise<void> {
    logger.info(`Indexing ${docs.length} documents...`);
    
    for (const doc of docs) {
      await this.indexDocument(doc);
    }
    
    logger.info('Document indexing completed');
  }

  async retrieveRelevant(
    queryText: string,
    userId?: string,
    topK: number = 5
  ): Promise<RetrievalResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Get all vectors (in production, you'd use a proper vector DB with similarity search)
      const vectors = await (this.db as any).aIKBVector.findMany({
        where: {
          OR: [
            { namespace: 'global' },
            ...(userId ? [{ namespace: `user_${userId}` }] : [])
          ]
        }
      });

      // Calculate cosine similarity
      const results: RetrievalResult[] = (vectors as Array<any>)
        .map((vec: any): RetrievalResult => {
          const similarity = this.cosineSimilarity(queryEmbedding, vec.vector as number[]);
          return {
            docId: String(vec.docId),
            title: String(vec.title),
            text: String(vec.text),
            tags: Array.isArray(vec.tags) ? (vec.tags as string[]) : [],
            score: Number(similarity)
          } as RetrievalResult;
        })
        .sort((a: RetrievalResult, b: RetrievalResult) => b.score - a.score)
        .slice(0, topK);

      return results;
    } catch (error) {
      logger.error('Failed to retrieve relevant documents:', error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async ensureBaseMedicalKBIndexed(): Promise<void> {
    try {
      // Check if base KB is already indexed
      const existingCount = await (this.db as any).aIKBVector.count({
        where: { namespace: 'global' }
      });

      if (existingCount > 0) {
        logger.info('Base medical KB already indexed');
        return;
      }

      logger.info('Indexing base medical knowledge base...');
      
      const baseMedicalKB: KBDocument[] = [
        {
          id: 'common_cold',
          title: 'Common Cold (Viral Upper Respiratory Infection)',
          text: 'Common cold is a viral infection of the upper respiratory tract. Symptoms include runny nose, nasal congestion, sneezing, cough, sore throat, and mild headache. Usually self-limiting, lasting 7-10 days. Most common causative agents are rhinoviruses, coronaviruses, and adenoviruses. Treatment is supportive with rest, fluids, and symptom management.',
          tags: ['respiratory', 'viral', 'common', 'self-limiting']
        },
        {
          id: 'influenza',
          title: 'Influenza (Flu)',
          text: 'Influenza is a viral respiratory illness caused by influenza A or B viruses. Symptoms include sudden onset of fever, chills, myalgia, headache, fatigue, cough, and sore throat. More severe than common cold. Can lead to complications like pneumonia, especially in high-risk groups. Treatment includes antivirals if started within 48 hours.',
          tags: ['respiratory', 'viral', 'fever', 'myalgia', 'seasonal']
        },
        {
          id: 'allergic_rhinitis',
          title: 'Allergic Rhinitis (Hay Fever)',
          text: 'Allergic rhinitis is an allergic reaction causing nasal symptoms. Symptoms include runny nose, sneezing, nasal congestion, and itchy eyes/nose. Often seasonal (pollen) or perennial (dust mites, pet dander). Associated with family history of allergies. Treatment includes antihistamines, nasal corticosteroids, and allergen avoidance.',
          tags: ['allergic', 'seasonal', 'rhinitis', 'antihistamines']
        },
        {
          id: 'sinusitis',
          title: 'Acute Sinusitis',
          text: 'Acute sinusitis is inflammation of the paranasal sinuses, often following viral URI. Symptoms include facial pain/pressure, purulent nasal discharge, nasal congestion, and headache. Bacterial sinusitis suspected if symptoms persist >10 days or worsen after initial improvement. Treatment includes decongestants, nasal irrigation, and antibiotics if bacterial.',
          tags: ['sinuses', 'facial_pain', 'purulent', 'bacterial']
        },
        {
          id: 'covid19',
          title: 'COVID-19',
          text: 'COVID-19 is caused by SARS-CoV-2 virus. Symptoms range from asymptomatic to severe. Common symptoms include fever, cough, shortness of breath, fatigue, body aches, headache, loss of taste/smell. Can progress to pneumonia and ARDS. Risk factors include age >65, diabetes, hypertension, obesity. Treatment is supportive; antivirals available for high-risk patients.',
          tags: ['covid', 'coronavirus', 'pandemic', 'loss_of_taste']
        },
        {
          id: 'pneumonia',
          title: 'Community-Acquired Pneumonia',
          text: 'Pneumonia is infection of the lung parenchyma. Symptoms include fever, productive cough, dyspnea, chest pain, and malaise. Physical exam may reveal crackles, dullness to percussion. Chest X-ray shows infiltrates. Common pathogens include S. pneumoniae, H. influenzae, atypical bacteria. Treatment with antibiotics based on severity and risk factors.',
          tags: ['pneumonia', 'bacterial', 'chest_xray', 'antibiotics']
        },
        {
          id: 'bronchitis',
          title: 'Acute Bronchitis',
          text: 'Acute bronchitis is inflammation of the bronchi, usually viral. Symptoms include productive cough lasting 1-3 weeks, often following URI. May have low-grade fever and chest discomfort. Usually self-limiting. Antibiotics not indicated unless bacterial superinfection suspected. Treatment is supportive with cough suppressants and bronchodilators if wheezing.',
          tags: ['bronchitis', 'viral', 'cough', 'self-limiting']
        },
        {
          id: 'red_flags_respiratory',
          title: 'Respiratory Red Flags',
          text: 'Red flag symptoms requiring urgent evaluation: severe dyspnea, chest pain, high fever >39°C, hemoptysis, altered mental status, severe headache with neck stiffness, signs of sepsis (hypotension, tachycardia), oxygen saturation <92%, inability to speak in full sentences due to dyspnea.',
          tags: ['red_flags', 'emergency', 'dyspnea', 'sepsis']
        }
      ];

      await this.indexDocuments(baseMedicalKB);
      logger.info('Base medical KB indexing completed');
    } catch (error) {
      logger.error('Failed to index base medical KB:', error);
    }
  }
}
