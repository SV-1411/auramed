import asyncio
from typing import List, Dict, Any, Optional
import json
import re
from datetime import datetime

class SymptomAnalyzer:
    def __init__(self):
        # Medical knowledge base - in production, this would be a proper medical database
        self.symptom_conditions_map = {
            "fever": ["viral infection", "bacterial infection", "flu", "covid-19"],
            "cough": ["cold", "flu", "pneumonia", "bronchitis", "covid-19"],
            "headache": ["tension headache", "migraine", "sinusitis", "hypertension"],
            "chest pain": ["heart attack", "angina", "pneumonia", "acid reflux"],
            "shortness of breath": ["asthma", "pneumonia", "heart failure", "anxiety"],
            "nausea": ["gastroenteritis", "food poisoning", "pregnancy", "migraine"],
            "vomiting": ["gastroenteritis", "food poisoning", "appendicitis", "migraine"],
            "abdominal pain": ["appendicitis", "gastroenteritis", "gallstones", "ulcer"],
            "diarrhea": ["gastroenteritis", "food poisoning", "IBS", "infection"],
            "fatigue": ["anemia", "depression", "thyroid disorder", "chronic fatigue syndrome"],
            "dizziness": ["vertigo", "low blood pressure", "dehydration", "inner ear infection"],
            "rash": ["allergic reaction", "eczema", "viral infection", "contact dermatitis"],
            "joint pain": ["arthritis", "injury", "autoimmune disorder", "infection"],
            "back pain": ["muscle strain", "herniated disc", "arthritis", "kidney stones"],
            "sore throat": ["viral infection", "strep throat", "allergies", "acid reflux"]
        }
        
        self.red_flag_symptoms = [
            "severe chest pain", "difficulty breathing", "loss of consciousness",
            "severe headache", "high fever", "severe abdominal pain",
            "blood in stool", "blood in urine", "severe allergic reaction",
            "stroke symptoms", "heart attack symptoms"
        ]
        
        self.specialization_map = {
            "heart": ["cardiology"],
            "chest": ["cardiology", "pulmonology"],
            "lung": ["pulmonology"],
            "stomach": ["gastroenterology"],
            "abdominal": ["gastroenterology"],
            "skin": ["dermatology"],
            "joint": ["rheumatology", "orthopedics"],
            "bone": ["orthopedics"],
            "neurological": ["neurology"],
            "mental": ["psychiatry", "psychology"],
            "eye": ["ophthalmology"],
            "ear": ["ENT"],
            "throat": ["ENT"],
            "kidney": ["nephrology"],
            "diabetes": ["endocrinology"]
        }

    async def analyze(
        self,
        symptoms: List[str],
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        medical_history: Optional[List[str]] = None,
        current_medications: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze symptoms and return structured medical assessment
        """
        try:
            # Normalize symptoms
            normalized_symptoms = [self._normalize_symptom(symptom) for symptom in symptoms]
            
            # Find possible conditions
            possible_conditions = self._find_possible_conditions(normalized_symptoms)
            
            # Check for red flags
            red_flags = self._check_red_flags(symptoms)
            
            # Determine recommended specialization
            recommended_specialization = self._get_recommended_specialization(
                normalized_symptoms, possible_conditions
            )
            
            # Generate recommended actions
            recommended_actions = self._generate_recommended_actions(
                normalized_symptoms, red_flags, patient_age
            )
            
            # Calculate confidence score
            confidence = self._calculate_confidence(
                normalized_symptoms, possible_conditions, medical_history
            )
            
            # Generate explanation
            explanation = self._generate_explanation(
                normalized_symptoms, possible_conditions, red_flags
            )
            
            return {
                "possible_conditions": possible_conditions[:5],  # Top 5 conditions
                "recommended_specialization": recommended_specialization,
                "recommended_actions": recommended_actions,
                "red_flags": red_flags,
                "confidence": confidence,
                "explanation": explanation,
                "analyzed_symptoms": normalized_symptoms,
                "analysis_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "possible_conditions": ["Unable to analyze - please consult healthcare provider"],
                "recommended_specialization": ["general_medicine"],
                "recommended_actions": ["Schedule consultation with healthcare provider"],
                "red_flags": [],
                "confidence": 0.1,
                "explanation": f"Analysis error: {str(e)}. Please consult with a healthcare professional.",
                "analyzed_symptoms": symptoms,
                "analysis_timestamp": datetime.now().isoformat()
            }

    def _normalize_symptom(self, symptom: str) -> str:
        """Normalize symptom text for better matching"""
        symptom = symptom.lower().strip()
        # Remove common prefixes/suffixes
        symptom = re.sub(r'^(i have|experiencing|feeling|severe|mild|chronic)\s+', '', symptom)
        symptom = re.sub(r'\s+(pain|ache|aches|symptoms?)$', '', symptom)
        return symptom

    def _find_possible_conditions(self, symptoms: List[str]) -> List[str]:
        """Find possible medical conditions based on symptoms"""
        condition_scores = {}
        
        for symptom in symptoms:
            # Direct matches
            if symptom in self.symptom_conditions_map:
                for condition in self.symptom_conditions_map[symptom]:
                    condition_scores[condition] = condition_scores.get(condition, 0) + 2
            
            # Partial matches
            for key_symptom, conditions in self.symptom_conditions_map.items():
                if key_symptom in symptom or symptom in key_symptom:
                    for condition in conditions:
                        condition_scores[condition] = condition_scores.get(condition, 0) + 1
        
        # Sort by score and return top conditions
        sorted_conditions = sorted(condition_scores.items(), key=lambda x: x[1], reverse=True)
        return [condition for condition, score in sorted_conditions if score > 0]

    def _check_red_flags(self, symptoms: List[str]) -> List[str]:
        """Check for red flag symptoms that require immediate attention"""
        red_flags = []
        
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            
            # Check for emergency keywords
            emergency_keywords = [
                "severe", "intense", "crushing", "sudden", "acute",
                "blood", "bleeding", "unconscious", "difficulty breathing",
                "chest pain", "heart attack", "stroke"
            ]
            
            for keyword in emergency_keywords:
                if keyword in symptom_lower:
                    red_flags.append(f"Emergency keyword detected: {keyword}")
            
            # Check against known red flag symptoms
            for red_flag in self.red_flag_symptoms:
                if red_flag in symptom_lower:
                    red_flags.append(f"Critical symptom: {red_flag}")
        
        return list(set(red_flags))  # Remove duplicates

    def _get_recommended_specialization(
        self, symptoms: List[str], conditions: List[str]
    ) -> List[str]:
        """Determine recommended medical specialization"""
        specializations = set()
        
        # Based on symptoms
        for symptom in symptoms:
            for body_part, specs in self.specialization_map.items():
                if body_part in symptom:
                    specializations.update(specs)
        
        # Based on conditions
        condition_specialization_map = {
            "heart": ["cardiology"],
            "cardiac": ["cardiology"],
            "lung": ["pulmonology"],
            "respiratory": ["pulmonology"],
            "gastro": ["gastroenterology"],
            "stomach": ["gastroenterology"],
            "skin": ["dermatology"],
            "joint": ["rheumatology"],
            "bone": ["orthopedics"],
            "neuro": ["neurology"],
            "mental": ["psychiatry"],
            "diabetes": ["endocrinology"],
            "kidney": ["nephrology"]
        }
        
        for condition in conditions:
            condition_lower = condition.lower()
            for keyword, specs in condition_specialization_map.items():
                if keyword in condition_lower:
                    specializations.update(specs)
        
        # Default to general medicine if no specific specialization found
        if not specializations:
            specializations.add("general_medicine")
        
        return list(specializations)

    def _generate_recommended_actions(
        self, symptoms: List[str], red_flags: List[str], patient_age: Optional[int]
    ) -> List[str]:
        """Generate recommended actions based on analysis"""
        actions = []
        
        if red_flags:
            actions.append("Seek immediate emergency medical attention")
            actions.append("Call emergency services if symptoms are severe")
        else:
            # Determine urgency based on symptom severity
            severe_symptoms = ["severe", "intense", "acute", "sudden"]
            has_severe = any(
                any(severe in symptom.lower() for severe in severe_symptoms)
                for symptom in symptoms
            )
            
            if has_severe:
                actions.append("Schedule urgent consultation within 24 hours")
            else:
                actions.append("Schedule consultation with healthcare provider")
            
            # Age-specific recommendations
            if patient_age and patient_age > 65:
                actions.append("Consider comprehensive geriatric assessment")
            elif patient_age and patient_age < 18:
                actions.append("Consult pediatric healthcare provider")
            
            # General recommendations
            actions.extend([
                "Monitor symptoms and note any changes",
                "Maintain symptom diary",
                "Stay hydrated and get adequate rest"
            ])
        
        return actions

    def _calculate_confidence(
        self, symptoms: List[str], conditions: List[str], medical_history: Optional[List[str]]
    ) -> float:
        """Calculate confidence score for the analysis"""
        base_confidence = 0.6
        
        # Increase confidence with more symptoms
        symptom_bonus = min(len(symptoms) * 0.05, 0.2)
        
        # Increase confidence if conditions are found
        condition_bonus = min(len(conditions) * 0.03, 0.15)
        
        # Increase confidence if medical history is provided
        history_bonus = 0.1 if medical_history and len(medical_history) > 0 else 0
        
        # Decrease confidence for vague symptoms
        vague_symptoms = ["pain", "discomfort", "feeling unwell", "tired"]
        vague_penalty = sum(0.05 for symptom in symptoms if any(vague in symptom.lower() for vague in vague_symptoms))
        
        confidence = base_confidence + symptom_bonus + condition_bonus + history_bonus - vague_penalty
        return max(0.1, min(0.95, confidence))  # Clamp between 0.1 and 0.95

    def _generate_explanation(
        self, symptoms: List[str], conditions: List[str], red_flags: List[str]
    ) -> str:
        """Generate human-readable explanation of the analysis"""
        explanation = f"Based on the reported symptoms ({', '.join(symptoms)}), "
        
        if red_flags:
            explanation += "several concerning indicators have been identified that require immediate medical attention. "
        elif conditions:
            explanation += f"the most likely conditions to consider include {', '.join(conditions[:3])}. "
        else:
            explanation += "a general medical evaluation is recommended. "
        
        explanation += "This analysis is for informational purposes only and should not replace professional medical advice. "
        explanation += "Please consult with a qualified healthcare provider for proper diagnosis and treatment."
        
        return explanation
