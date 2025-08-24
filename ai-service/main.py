from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import os
from datetime import datetime
import logging

# Import our AI services
from services.symptom_analyzer import SymptomAnalyzer
from services.risk_scorer import RiskScorer
from services.medical_nlp import MedicalNLP
from services.drug_interaction_checker import DrugInteractionChecker
from config.database import get_database_connection
from utils.logger import setup_logger

# Setup logging
logger = setup_logger()

app = FastAPI(
    title="AuraMed AI Service",
    description="AI/ML microservice for healthcare analysis and predictions",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI services
symptom_analyzer = SymptomAnalyzer()
risk_scorer = RiskScorer()
medical_nlp = MedicalNLP()
drug_checker = DrugInteractionChecker()

# Pydantic models
class SymptomAnalysisRequest(BaseModel):
    symptoms: List[str]
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    medical_history: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []

class SymptomAnalysisResponse(BaseModel):
    risk_level: str
    risk_score: int
    urgency: str
    possible_conditions: List[str]
    recommended_specialization: List[str]
    recommended_actions: List[str]
    red_flags: List[str]
    confidence: float
    explanation: str

class DrugInteractionRequest(BaseModel):
    medications: List[str]
    patient_age: Optional[int] = None
    patient_conditions: Optional[List[str]] = []

class DrugInteractionResponse(BaseModel):
    interactions: List[Dict[str, Any]]
    warnings: List[str]
    severity_level: str
    recommendations: List[str]

class MedicalTextRequest(BaseModel):
    text: str
    extract_entities: bool = True
    analyze_sentiment: bool = False

class MedicalTextResponse(BaseModel):
    entities: Dict[str, List[str]]
    sentiment: Optional[str] = None
    processed_text: str
    medical_terms: List[str]

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "auramed-ai-service",
        "version": "1.0.0"
    }

# Symptom analysis endpoint
@app.post("/analyze-symptoms", response_model=SymptomAnalysisResponse)
async def analyze_symptoms(request: SymptomAnalysisRequest):
    try:
        logger.info(f"Analyzing symptoms: {request.symptoms}")
        
        # Analyze symptoms using our AI models
        analysis = await symptom_analyzer.analyze(
            symptoms=request.symptoms,
            patient_age=request.patient_age,
            patient_gender=request.patient_gender,
            medical_history=request.medical_history,
            current_medications=request.current_medications
        )
        
        # Calculate risk score
        risk_data = await risk_scorer.calculate_risk(
            symptoms=request.symptoms,
            analysis_result=analysis,
            patient_age=request.patient_age,
            medical_history=request.medical_history
        )
        
        response = SymptomAnalysisResponse(
            risk_level=risk_data["risk_level"],
            risk_score=risk_data["risk_score"],
            urgency=risk_data["urgency"],
            possible_conditions=analysis["possible_conditions"],
            recommended_specialization=analysis["recommended_specialization"],
            recommended_actions=analysis["recommended_actions"],
            red_flags=analysis["red_flags"],
            confidence=analysis["confidence"],
            explanation=analysis["explanation"]
        )
        
        logger.info(f"Symptom analysis completed with risk level: {response.risk_level}")
        return response
        
    except Exception as e:
        logger.error(f"Error in symptom analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Drug interaction checking
@app.post("/check-drug-interactions", response_model=DrugInteractionResponse)
async def check_drug_interactions(request: DrugInteractionRequest):
    try:
        logger.info(f"Checking drug interactions for: {request.medications}")
        
        interactions = await drug_checker.check_interactions(
            medications=request.medications,
            patient_age=request.patient_age,
            patient_conditions=request.patient_conditions
        )
        
        response = DrugInteractionResponse(
            interactions=interactions["interactions"],
            warnings=interactions["warnings"],
            severity_level=interactions["severity_level"],
            recommendations=interactions["recommendations"]
        )
        
        logger.info(f"Drug interaction check completed with {len(interactions['interactions'])} interactions found")
        return response
        
    except Exception as e:
        logger.error(f"Error in drug interaction check: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Drug interaction check failed: {str(e)}")

# Medical text processing
@app.post("/process-medical-text", response_model=MedicalTextResponse)
async def process_medical_text(request: MedicalTextRequest):
    try:
        logger.info("Processing medical text")
        
        result = await medical_nlp.process_text(
            text=request.text,
            extract_entities=request.extract_entities,
            analyze_sentiment=request.analyze_sentiment
        )
        
        response = MedicalTextResponse(
            entities=result["entities"],
            sentiment=result.get("sentiment"),
            processed_text=result["processed_text"],
            medical_terms=result["medical_terms"]
        )
        
        logger.info("Medical text processing completed")
        return response
        
    except Exception as e:
        logger.error(f"Error in medical text processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Text processing failed: {str(e)}")

# Predict health trends
@app.post("/predict-health-trends")
async def predict_health_trends(
    patient_id: str,
    historical_data: List[Dict[str, Any]]
):
    try:
        logger.info(f"Predicting health trends for patient: {patient_id}")
        
        # This would use ML models to predict health trends
        # For now, return a mock response
        trends = {
            "patient_id": patient_id,
            "predictions": [
                {
                    "condition": "Hypertension Risk",
                    "probability": 0.25,
                    "timeframe": "6 months",
                    "confidence": 0.78
                },
                {
                    "condition": "Diabetes Risk",
                    "probability": 0.15,
                    "timeframe": "12 months", 
                    "confidence": 0.65
                }
            ],
            "recommendations": [
                "Regular blood pressure monitoring",
                "Maintain healthy diet",
                "Regular exercise routine"
            ],
            "generated_at": datetime.now().isoformat()
        }
        
        logger.info(f"Health trend prediction completed for patient: {patient_id}")
        return trends
        
    except Exception as e:
        logger.error(f"Error in health trend prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# Generate medical insights
@app.post("/generate-insights")
async def generate_medical_insights(
    patient_data: Dict[str, Any],
    consultation_history: List[Dict[str, Any]]
):
    try:
        logger.info("Generating medical insights")
        
        # This would use advanced ML models to generate insights
        # For now, return a structured response
        insights = {
            "patient_summary": {
                "risk_factors": ["Age", "Family history", "Lifestyle"],
                "chronic_conditions": [],
                "medication_adherence": "Good",
                "last_consultation": consultation_history[-1] if consultation_history else None
            },
            "recommendations": [
                {
                    "type": "preventive",
                    "title": "Annual Health Checkup",
                    "description": "Schedule comprehensive health screening",
                    "priority": "medium"
                },
                {
                    "type": "lifestyle",
                    "title": "Exercise Routine",
                    "description": "Maintain regular physical activity",
                    "priority": "high"
                }
            ],
            "alerts": [],
            "generated_at": datetime.now().isoformat()
        }
        
        logger.info("Medical insights generation completed")
        return insights
        
    except Exception as e:
        logger.error(f"Error generating medical insights: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Insight generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True if os.getenv("ENVIRONMENT") == "development" else False
    )
