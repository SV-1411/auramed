from typing import List, Dict, Any, Optional
from datetime import datetime
import math

class RiskScorer:
    def __init__(self):
        # Risk scoring weights
        self.symptom_weights = {
            "chest pain": 85,
            "difficulty breathing": 80,
            "severe headache": 75,
            "blood in stool": 70,
            "blood in urine": 70,
            "high fever": 65,
            "severe abdominal pain": 65,
            "loss of consciousness": 95,
            "stroke symptoms": 95,
            "heart attack symptoms": 95,
            "severe allergic reaction": 90,
            "shortness of breath": 60,
            "persistent cough": 40,
            "nausea": 30,
            "headache": 35,
            "fatigue": 25,
            "mild fever": 30,
            "sore throat": 20,
            "runny nose": 15
        }
        
        # Age risk multipliers
        self.age_multipliers = {
            (0, 2): 1.3,    # Infants
            (2, 12): 1.1,   # Children
            (12, 18): 1.0,  # Adolescents
            (18, 65): 1.0,  # Adults
            (65, 80): 1.2,  # Elderly
            (80, 120): 1.4  # Very elderly
        }
        
        # Condition risk factors
        self.high_risk_conditions = {
            "heart attack": 95,
            "stroke": 95,
            "pulmonary embolism": 90,
            "sepsis": 90,
            "anaphylaxis": 90,
            "pneumonia": 70,
            "appendicitis": 75,
            "meningitis": 85,
            "diabetic ketoacidosis": 80
        }

    async def calculate_risk(
        self,
        symptoms: List[str],
        analysis_result: Dict[str, Any],
        patient_age: Optional[int] = None,
        medical_history: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Calculate comprehensive risk score"""
        
        try:
            # Base risk from symptoms
            symptom_risk = self._calculate_symptom_risk(symptoms)
            
            # Risk from possible conditions
            condition_risk = self._calculate_condition_risk(analysis_result.get("possible_conditions", []))
            
            # Age-based risk adjustment
            age_multiplier = self._get_age_multiplier(patient_age)
            
            # Medical history risk adjustment
            history_multiplier = self._get_history_multiplier(medical_history)
            
            # Red flags impact
            red_flag_bonus = len(analysis_result.get("red_flags", [])) * 20
            
            # Calculate final risk score
            base_score = max(symptom_risk, condition_risk)
            adjusted_score = (base_score * age_multiplier * history_multiplier) + red_flag_bonus
            
            # Clamp score between 0-100
            final_score = max(0, min(100, int(adjusted_score)))
            
            # Determine risk level and urgency
            risk_level = self._get_risk_level(final_score)
            urgency = self._get_urgency_level(final_score, analysis_result.get("red_flags", []))
            
            return {
                "risk_score": final_score,
                "risk_level": risk_level,
                "urgency": urgency,
                "risk_factors": {
                    "symptom_risk": symptom_risk,
                    "condition_risk": condition_risk,
                    "age_multiplier": age_multiplier,
                    "history_multiplier": history_multiplier,
                    "red_flag_bonus": red_flag_bonus
                },
                "recommendations": self._get_risk_recommendations(risk_level, urgency),
                "calculated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            # Fallback to medium risk if calculation fails
            return {
                "risk_score": 50,
                "risk_level": "medium",
                "urgency": "routine",
                "risk_factors": {"error": str(e)},
                "recommendations": ["Consult healthcare provider for evaluation"],
                "calculated_at": datetime.now().isoformat()
            }

    def _calculate_symptom_risk(self, symptoms: List[str]) -> float:
        """Calculate risk score based on symptoms"""
        total_risk = 0
        symptom_count = len(symptoms)
        
        for symptom in symptoms:
            symptom_lower = symptom.lower()
            
            # Direct symptom matching
            for key_symptom, weight in self.symptom_weights.items():
                if key_symptom in symptom_lower:
                    total_risk += weight
                    break
            else:
                # Default weight for unrecognized symptoms
                total_risk += 25
        
        # Multiple symptoms increase risk
        if symptom_count > 3:
            total_risk *= 1.2
        elif symptom_count > 5:
            total_risk *= 1.4
        
        return min(total_risk / symptom_count if symptom_count > 0 else 0, 100)

    def _calculate_condition_risk(self, conditions: List[str]) -> float:
        """Calculate risk score based on possible conditions"""
        if not conditions:
            return 0
        
        max_risk = 0
        for condition in conditions:
            condition_lower = condition.lower()
            
            for high_risk_condition, risk_score in self.high_risk_conditions.items():
                if high_risk_condition in condition_lower:
                    max_risk = max(max_risk, risk_score)
                    break
            else:
                # Default risk for other conditions
                max_risk = max(max_risk, 40)
        
        return max_risk

    def _get_age_multiplier(self, age: Optional[int]) -> float:
        """Get age-based risk multiplier"""
        if age is None:
            return 1.0
        
        for (min_age, max_age), multiplier in self.age_multipliers.items():
            if min_age <= age < max_age:
                return multiplier
        
        return 1.0

    def _get_history_multiplier(self, medical_history: Optional[List[str]]) -> float:
        """Get medical history-based risk multiplier"""
        if not medical_history:
            return 1.0
        
        high_risk_history = [
            "diabetes", "hypertension", "heart disease", "cancer",
            "kidney disease", "liver disease", "autoimmune", "copd",
            "asthma", "stroke", "heart attack"
        ]
        
        risk_count = 0
        for condition in medical_history:
            condition_lower = condition.lower()
            for risk_condition in high_risk_history:
                if risk_condition in condition_lower:
                    risk_count += 1
                    break
        
        # Increase multiplier based on number of risk factors
        return 1.0 + (risk_count * 0.1)

    def _get_risk_level(self, score: int) -> str:
        """Convert numeric score to risk level"""
        if score >= 80:
            return "critical"
        elif score >= 60:
            return "high"
        elif score >= 40:
            return "medium"
        else:
            return "low"

    def _get_urgency_level(self, score: int, red_flags: List[str]) -> str:
        """Determine urgency level"""
        if red_flags or score >= 85:
            return "emergency"
        elif score >= 70:
            return "urgent"
        elif score >= 50:
            return "semi_urgent"
        else:
            return "routine"

    def _get_risk_recommendations(self, risk_level: str, urgency: str) -> List[str]:
        """Get recommendations based on risk level and urgency"""
        recommendations = []
        
        if urgency == "emergency":
            recommendations.extend([
                "Seek immediate emergency medical attention",
                "Call emergency services (911) if symptoms are severe",
                "Do not delay medical care"
            ])
        elif urgency == "urgent":
            recommendations.extend([
                "Schedule urgent medical consultation within 24 hours",
                "Monitor symptoms closely",
                "Seek emergency care if symptoms worsen"
            ])
        elif urgency == "semi_urgent":
            recommendations.extend([
                "Schedule medical consultation within 2-3 days",
                "Monitor symptoms and note any changes",
                "Contact healthcare provider if symptoms worsen"
            ])
        else:
            recommendations.extend([
                "Schedule routine medical consultation",
                "Monitor symptoms over the next few days",
                "Maintain symptom diary"
            ])
        
        # General recommendations based on risk level
        if risk_level in ["high", "critical"]:
            recommendations.extend([
                "Avoid strenuous activities",
                "Stay hydrated",
                "Have someone stay with you if possible"
            ])
        else:
            recommendations.extend([
                "Get adequate rest",
                "Stay hydrated",
                "Follow up if symptoms persist or worsen"
            ])
        
        return recommendations

    def calculate_trend_risk(self, historical_scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate risk trend based on historical data"""
        if len(historical_scores) < 2:
            return {"trend": "insufficient_data", "direction": "stable"}
        
        recent_scores = [score["risk_score"] for score in historical_scores[-5:]]
        
        # Calculate trend
        if len(recent_scores) >= 3:
            slope = (recent_scores[-1] - recent_scores[0]) / len(recent_scores)
            
            if slope > 5:
                trend = "increasing"
                direction = "worsening"
            elif slope < -5:
                trend = "decreasing"
                direction = "improving"
            else:
                trend = "stable"
                direction = "stable"
        else:
            trend = "stable"
            direction = "stable"
        
        return {
            "trend": trend,
            "direction": direction,
            "recent_scores": recent_scores,
            "average_score": sum(recent_scores) / len(recent_scores),
            "calculated_at": datetime.now().isoformat()
        }
