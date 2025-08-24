import asyncio
from typing import List, Dict, Any, Optional
import json
import re
from datetime import datetime

class DrugInteractionChecker:
    """Service for checking drug interactions and contraindications"""
    
    def __init__(self):
        self.interaction_database = self._load_interaction_database()
        self.contraindication_database = self._load_contraindication_database()
    
    def _load_interaction_database(self) -> Dict[str, Any]:
        """Load drug interaction database (simplified for demo)"""
        return {
            "warfarin": {
                "major_interactions": [
                    "aspirin", "ibuprofen", "naproxen", "diclofenac",
                    "amiodarone", "fluconazole", "metronidazole"
                ],
                "moderate_interactions": [
                    "acetaminophen", "omeprazole", "simvastatin"
                ],
                "effects": {
                    "aspirin": "Increased bleeding risk",
                    "ibuprofen": "Increased bleeding risk",
                    "amiodarone": "Increased anticoagulation effect"
                }
            },
            "metformin": {
                "major_interactions": [
                    "contrast_dye", "alcohol"
                ],
                "moderate_interactions": [
                    "furosemide", "nifedipine", "prednisone"
                ],
                "effects": {
                    "contrast_dye": "Risk of lactic acidosis",
                    "alcohol": "Risk of lactic acidosis"
                }
            },
            "lisinopril": {
                "major_interactions": [
                    "potassium_supplements", "spironolactone", "amiloride"
                ],
                "moderate_interactions": [
                    "ibuprofen", "naproxen", "lithium"
                ],
                "effects": {
                    "potassium_supplements": "Hyperkalemia risk",
                    "ibuprofen": "Reduced antihypertensive effect"
                }
            },
            "simvastatin": {
                "major_interactions": [
                    "gemfibrozil", "cyclosporine", "danazol"
                ],
                "moderate_interactions": [
                    "amlodipine", "diltiazem", "verapamil"
                ],
                "effects": {
                    "gemfibrozil": "Increased risk of myopathy",
                    "cyclosporine": "Increased risk of rhabdomyolysis"
                }
            }
        }
    
    def _load_contraindication_database(self) -> Dict[str, Any]:
        """Load contraindication database"""
        return {
            "warfarin": {
                "absolute_contraindications": [
                    "active_bleeding", "severe_liver_disease", "pregnancy"
                ],
                "relative_contraindications": [
                    "recent_surgery", "peptic_ulcer", "hypertension_uncontrolled"
                ]
            },
            "metformin": {
                "absolute_contraindications": [
                    "kidney_disease_severe", "liver_disease", "heart_failure_severe"
                ],
                "relative_contraindications": [
                    "kidney_disease_moderate", "alcohol_abuse", "elderly_over_80"
                ]
            },
            "ace_inhibitors": {
                "absolute_contraindications": [
                    "pregnancy", "angioedema_history", "bilateral_renal_artery_stenosis"
                ],
                "relative_contraindications": [
                    "kidney_disease", "hyperkalemia", "hypotension"
                ]
            }
        }
    
    async def check_drug_interactions(self, medications: List[str]) -> Dict[str, Any]:
        """Check for interactions between multiple medications"""
        try:
            interactions = []
            normalized_meds = [self._normalize_drug_name(med) for med in medications]
            
            # Check each pair of medications
            for i, med1 in enumerate(normalized_meds):
                for j, med2 in enumerate(normalized_meds[i+1:], i+1):
                    interaction = await self._check_pair_interaction(med1, med2)
                    if interaction:
                        interactions.append(interaction)
            
            # Calculate overall risk score
            risk_score = self._calculate_interaction_risk_score(interactions)
            
            return {
                "interactions": interactions,
                "risk_score": risk_score,
                "risk_level": self._get_risk_level(risk_score),
                "recommendations": self._generate_interaction_recommendations(interactions),
                "total_medications": len(medications),
                "checked_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "error": f"Drug interaction check failed: {str(e)}",
                "interactions": [],
                "risk_score": 0,
                "risk_level": "unknown"
            }
    
    async def _check_pair_interaction(self, drug1: str, drug2: str) -> Optional[Dict[str, Any]]:
        """Check interaction between two specific drugs"""
        # Check if drug1 has interactions with drug2
        if drug1 in self.interaction_database:
            drug1_data = self.interaction_database[drug1]
            
            if drug2 in drug1_data.get("major_interactions", []):
                return {
                    "drug1": drug1,
                    "drug2": drug2,
                    "severity": "major",
                    "effect": drug1_data.get("effects", {}).get(drug2, "Significant interaction"),
                    "recommendation": "Avoid combination or monitor closely"
                }
            elif drug2 in drug1_data.get("moderate_interactions", []):
                return {
                    "drug1": drug1,
                    "drug2": drug2,
                    "severity": "moderate",
                    "effect": drug1_data.get("effects", {}).get(drug2, "Moderate interaction"),
                    "recommendation": "Monitor for adverse effects"
                }
        
        # Check reverse interaction (drug2 with drug1)
        if drug2 in self.interaction_database:
            drug2_data = self.interaction_database[drug2]
            
            if drug1 in drug2_data.get("major_interactions", []):
                return {
                    "drug1": drug2,
                    "drug2": drug1,
                    "severity": "major",
                    "effect": drug2_data.get("effects", {}).get(drug1, "Significant interaction"),
                    "recommendation": "Avoid combination or monitor closely"
                }
            elif drug1 in drug2_data.get("moderate_interactions", []):
                return {
                    "drug1": drug2,
                    "drug2": drug1,
                    "severity": "moderate",
                    "effect": drug2_data.get("effects", {}).get(drug1, "Moderate interaction"),
                    "recommendation": "Monitor for adverse effects"
                }
        
        return None
    
    async def check_contraindications(self, medication: str, patient_conditions: List[str]) -> Dict[str, Any]:
        """Check contraindications for a medication given patient conditions"""
        try:
            normalized_med = self._normalize_drug_name(medication)
            normalized_conditions = [self._normalize_condition(cond) for cond in patient_conditions]
            
            contraindications = []
            
            # Check direct drug contraindications
            if normalized_med in self.contraindication_database:
                drug_data = self.contraindication_database[normalized_med]
                contraindications.extend(
                    self._check_condition_contraindications(drug_data, normalized_conditions)
                )
            
            # Check drug class contraindications
            drug_class = self._get_drug_class(normalized_med)
            if drug_class and drug_class in self.contraindication_database:
                class_data = self.contraindication_database[drug_class]
                contraindications.extend(
                    self._check_condition_contraindications(class_data, normalized_conditions)
                )
            
            risk_score = self._calculate_contraindication_risk_score(contraindications)
            
            return {
                "medication": medication,
                "contraindications": contraindications,
                "risk_score": risk_score,
                "risk_level": self._get_risk_level(risk_score),
                "recommendations": self._generate_contraindication_recommendations(contraindications),
                "is_safe": len([c for c in contraindications if c["severity"] == "absolute"]) == 0,
                "checked_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "error": f"Contraindication check failed: {str(e)}",
                "contraindications": [],
                "risk_score": 0,
                "is_safe": False
            }
    
    def _check_condition_contraindications(self, drug_data: Dict, conditions: List[str]) -> List[Dict[str, Any]]:
        """Check specific conditions against drug contraindications"""
        contraindications = []
        
        # Check absolute contraindications
        for condition in conditions:
            if condition in drug_data.get("absolute_contraindications", []):
                contraindications.append({
                    "condition": condition,
                    "severity": "absolute",
                    "recommendation": "Do not use this medication",
                    "risk_description": "High risk of serious adverse effects"
                })
        
        # Check relative contraindications
        for condition in conditions:
            if condition in drug_data.get("relative_contraindications", []):
                contraindications.append({
                    "condition": condition,
                    "severity": "relative",
                    "recommendation": "Use with caution and close monitoring",
                    "risk_description": "Increased risk of adverse effects"
                })
        
        return contraindications
    
    def _normalize_drug_name(self, drug_name: str) -> str:
        """Normalize drug name for database lookup"""
        # Remove common suffixes and normalize
        normalized = drug_name.lower().strip()
        normalized = re.sub(r'\s+(mg|mcg|g|ml|tablets?|capsules?|injection).*$', '', normalized)
        normalized = re.sub(r'\s+', '_', normalized)
        
        # Handle common drug name variations
        drug_mappings = {
            "acetaminophen": "acetaminophen",
            "paracetamol": "acetaminophen",
            "tylenol": "acetaminophen",
            "advil": "ibuprofen",
            "motrin": "ibuprofen",
            "aleve": "naproxen",
            "coumadin": "warfarin",
            "glucophage": "metformin",
            "prinivil": "lisinopril",
            "zestril": "lisinopril",
            "zocor": "simvastatin"
        }
        
        return drug_mappings.get(normalized, normalized)
    
    def _normalize_condition(self, condition: str) -> str:
        """Normalize medical condition for database lookup"""
        normalized = condition.lower().strip()
        normalized = re.sub(r'\s+', '_', normalized)
        
        # Handle common condition variations
        condition_mappings = {
            "kidney_failure": "kidney_disease_severe",
            "renal_failure": "kidney_disease_severe",
            "liver_failure": "liver_disease",
            "hepatic_failure": "liver_disease",
            "heart_failure": "heart_failure_severe",
            "congestive_heart_failure": "heart_failure_severe",
            "bleeding": "active_bleeding",
            "hemorrhage": "active_bleeding"
        }
        
        return condition_mappings.get(normalized, normalized)
    
    def _get_drug_class(self, drug_name: str) -> Optional[str]:
        """Get drug class for broader contraindication checking"""
        drug_classes = {
            "lisinopril": "ace_inhibitors",
            "enalapril": "ace_inhibitors",
            "captopril": "ace_inhibitors",
            "ramipril": "ace_inhibitors"
        }
        return drug_classes.get(drug_name)
    
    def _calculate_interaction_risk_score(self, interactions: List[Dict]) -> int:
        """Calculate overall risk score for drug interactions"""
        if not interactions:
            return 0
        
        score = 0
        for interaction in interactions:
            if interaction["severity"] == "major":
                score += 30
            elif interaction["severity"] == "moderate":
                score += 15
            else:
                score += 5
        
        return min(score, 100)
    
    def _calculate_contraindication_risk_score(self, contraindications: List[Dict]) -> int:
        """Calculate risk score for contraindications"""
        if not contraindications:
            return 0
        
        score = 0
        for contraindication in contraindications:
            if contraindication["severity"] == "absolute":
                score += 50
            elif contraindication["severity"] == "relative":
                score += 25
        
        return min(score, 100)
    
    def _get_risk_level(self, score: int) -> str:
        """Convert risk score to risk level"""
        if score >= 70:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 30:
            return "medium"
        elif score > 0:
            return "low"
        else:
            return "minimal"
    
    def _generate_interaction_recommendations(self, interactions: List[Dict]) -> List[str]:
        """Generate recommendations based on interactions"""
        recommendations = []
        
        major_interactions = [i for i in interactions if i["severity"] == "major"]
        moderate_interactions = [i for i in interactions if i["severity"] == "moderate"]
        
        if major_interactions:
            recommendations.append("Consult healthcare provider immediately about major drug interactions")
            recommendations.append("Consider alternative medications to avoid serious interactions")
        
        if moderate_interactions:
            recommendations.append("Monitor closely for adverse effects from moderate interactions")
            recommendations.append("Regular follow-up appointments recommended")
        
        if not interactions:
            recommendations.append("No significant drug interactions detected")
        
        return recommendations
    
    def _generate_contraindication_recommendations(self, contraindications: List[Dict]) -> List[str]:
        """Generate recommendations based on contraindications"""
        recommendations = []
        
        absolute_contraindications = [c for c in contraindications if c["severity"] == "absolute"]
        relative_contraindications = [c for c in contraindications if c["severity"] == "relative"]
        
        if absolute_contraindications:
            recommendations.append("This medication is contraindicated - do not use")
            recommendations.append("Consult healthcare provider for alternative treatments")
        
        if relative_contraindications:
            recommendations.append("Use with extreme caution and close monitoring")
            recommendations.append("Benefits must outweigh risks")
            recommendations.append("Consider dose adjustment or alternative therapy")
        
        if not contraindications:
            recommendations.append("No contraindications detected for current conditions")
        
        return recommendations

    async def get_drug_information(self, drug_name: str) -> Dict[str, Any]:
        """Get comprehensive drug information"""
        try:
            normalized_name = self._normalize_drug_name(drug_name)
            
            # This would typically query a comprehensive drug database
            # For demo purposes, returning basic information
            drug_info = {
                "name": drug_name,
                "normalized_name": normalized_name,
                "class": self._get_drug_class(normalized_name) or "Unknown",
                "common_side_effects": self._get_common_side_effects(normalized_name),
                "monitoring_parameters": self._get_monitoring_parameters(normalized_name),
                "food_interactions": self._get_food_interactions(normalized_name),
                "pregnancy_category": self._get_pregnancy_category(normalized_name)
            }
            
            return drug_info
            
        except Exception as e:
            return {
                "error": f"Failed to get drug information: {str(e)}",
                "name": drug_name
            }
    
    def _get_common_side_effects(self, drug_name: str) -> List[str]:
        """Get common side effects for a drug"""
        side_effects_db = {
            "warfarin": ["bleeding", "bruising", "nausea", "hair_loss"],
            "metformin": ["nausea", "diarrhea", "metallic_taste", "vitamin_b12_deficiency"],
            "lisinopril": ["dry_cough", "dizziness", "hyperkalemia", "angioedema"],
            "simvastatin": ["muscle_pain", "liver_enzyme_elevation", "headache", "nausea"]
        }
        return side_effects_db.get(drug_name, ["consult_prescribing_information"])
    
    def _get_monitoring_parameters(self, drug_name: str) -> List[str]:
        """Get monitoring parameters for a drug"""
        monitoring_db = {
            "warfarin": ["INR", "PT", "bleeding_signs", "CBC"],
            "metformin": ["kidney_function", "liver_function", "vitamin_b12", "lactic_acid"],
            "lisinopril": ["blood_pressure", "kidney_function", "potassium", "cough"],
            "simvastatin": ["liver_enzymes", "muscle_symptoms", "lipid_profile"]
        }
        return monitoring_db.get(drug_name, ["routine_monitoring"])
    
    def _get_food_interactions(self, drug_name: str) -> List[str]:
        """Get food interactions for a drug"""
        food_interactions_db = {
            "warfarin": ["vitamin_k_foods", "alcohol", "cranberry_juice"],
            "metformin": ["alcohol", "take_with_food"],
            "lisinopril": ["potassium_rich_foods", "salt_substitutes"],
            "simvastatin": ["grapefruit_juice", "high_fat_meals"]
        }
        return food_interactions_db.get(drug_name, ["no_known_food_interactions"])
    
    def _get_pregnancy_category(self, drug_name: str) -> str:
        """Get pregnancy category for a drug"""
        pregnancy_db = {
            "warfarin": "X",
            "metformin": "B",
            "lisinopril": "D",
            "simvastatin": "X"
        }
        return pregnancy_db.get(drug_name, "Unknown")
