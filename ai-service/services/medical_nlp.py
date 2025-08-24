import asyncio
import re
import nltk
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

class MedicalNLP:
    """Natural Language Processing service for medical text analysis"""
    
    def __init__(self):
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        self.medical_entities = self._load_medical_entities()
        self.symptom_patterns = self._load_symptom_patterns()
        self.medication_patterns = self._load_medication_patterns()
        self.condition_patterns = self._load_condition_patterns()
    
    def _load_medical_entities(self) -> Dict[str, List[str]]:
        """Load medical entity dictionaries"""
        return {
            "symptoms": [
                "headache", "fever", "cough", "nausea", "vomiting", "diarrhea",
                "fatigue", "dizziness", "chest pain", "shortness of breath",
                "abdominal pain", "back pain", "joint pain", "muscle pain",
                "rash", "itching", "swelling", "bleeding", "bruising",
                "insomnia", "anxiety", "depression", "confusion"
            ],
            "body_parts": [
                "head", "neck", "chest", "abdomen", "back", "arm", "leg",
                "hand", "foot", "eye", "ear", "nose", "throat", "heart",
                "lung", "stomach", "liver", "kidney", "brain", "skin"
            ],
            "medications": [
                "aspirin", "ibuprofen", "acetaminophen", "metformin", "lisinopril",
                "simvastatin", "warfarin", "prednisone", "amoxicillin", "omeprazole"
            ],
            "conditions": [
                "diabetes", "hypertension", "asthma", "copd", "heart disease",
                "kidney disease", "liver disease", "cancer", "arthritis",
                "depression", "anxiety", "migraine", "pneumonia", "bronchitis"
            ]
        }
    
    def _load_symptom_patterns(self) -> List[Dict[str, Any]]:
        """Load symptom extraction patterns"""
        return [
            {
                "pattern": r"(?:i have|experiencing|suffering from|feeling)\s+(.+?)(?:\.|,|$)",
                "type": "direct_symptom"
            },
            {
                "pattern": r"(?:pain in|ache in|hurts in)\s+(?:my\s+)?(.+?)(?:\.|,|$)",
                "type": "pain_location"
            },
            {
                "pattern": r"(?:been|feeling|getting)\s+(.+?)\s+(?:for|since)",
                "type": "duration_symptom"
            },
            {
                "pattern": r"(?:severe|mild|moderate|chronic|acute)\s+(.+?)(?:\.|,|$)",
                "type": "severity_symptom"
            }
        ]
    
    def _load_medication_patterns(self) -> List[Dict[str, Any]]:
        """Load medication extraction patterns"""
        return [
            {
                "pattern": r"(?:taking|on|prescribed|using)\s+(.+?)\s+(?:mg|mcg|tablets?|capsules?)",
                "type": "current_medication"
            },
            {
                "pattern": r"(?:allergic to|allergy to|cannot take)\s+(.+?)(?:\.|,|$)",
                "type": "medication_allergy"
            },
            {
                "pattern": r"(?:stopped|discontinued|quit)\s+(.+?)\s+(?:because|due to)",
                "type": "discontinued_medication"
            }
        ]
    
    def _load_condition_patterns(self) -> List[Dict[str, Any]]:
        """Load medical condition extraction patterns"""
        return [
            {
                "pattern": r"(?:diagnosed with|have|history of)\s+(.+?)(?:\.|,|$)",
                "type": "medical_condition"
            },
            {
                "pattern": r"(?:family history of|runs in family)\s+(.+?)(?:\.|,|$)",
                "type": "family_history"
            },
            {
                "pattern": r"(?:surgery for|operation for|procedure for)\s+(.+?)(?:\.|,|$)",
                "type": "surgical_history"
            }
        ]
    
    async def extract_medical_entities(self, text: str) -> Dict[str, Any]:
        """Extract medical entities from text"""
        try:
            # Preprocess text
            processed_text = self._preprocess_text(text)
            
            # Extract different types of entities
            symptoms = await self._extract_symptoms(processed_text)
            medications = await self._extract_medications(processed_text)
            conditions = await self._extract_conditions(processed_text)
            body_parts = await self._extract_body_parts(processed_text)
            
            # Extract temporal information
            temporal_info = await self._extract_temporal_information(processed_text)
            
            # Extract severity and urgency indicators
            severity_info = await self._extract_severity_indicators(processed_text)
            
            return {
                "symptoms": symptoms,
                "medications": medications,
                "conditions": conditions,
                "body_parts": body_parts,
                "temporal_info": temporal_info,
                "severity_info": severity_info,
                "processed_text": processed_text,
                "original_text": text,
                "extracted_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "error": f"Entity extraction failed: {str(e)}",
                "symptoms": [],
                "medications": [],
                "conditions": [],
                "body_parts": []
            }
    
    async def _extract_symptoms(self, text: str) -> List[Dict[str, Any]]:
        """Extract symptoms from text"""
        symptoms = []
        
        # Use pattern matching
        for pattern_info in self.symptom_patterns:
            matches = re.finditer(pattern_info["pattern"], text, re.IGNORECASE)
            for match in matches:
                symptom_text = match.group(1).strip()
                if self._is_valid_symptom(symptom_text):
                    symptoms.append({
                        "text": symptom_text,
                        "type": pattern_info["type"],
                        "confidence": self._calculate_symptom_confidence(symptom_text),
                        "normalized": self._normalize_symptom(symptom_text)
                    })
        
        # Use entity matching
        words = word_tokenize(text.lower())
        for word in words:
            if word in self.medical_entities["symptoms"]:
                symptoms.append({
                    "text": word,
                    "type": "entity_match",
                    "confidence": 0.8,
                    "normalized": word
                })
        
        return self._deduplicate_entities(symptoms)
    
    async def _extract_medications(self, text: str) -> List[Dict[str, Any]]:
        """Extract medications from text"""
        medications = []
        
        # Use pattern matching
        for pattern_info in self.medication_patterns:
            matches = re.finditer(pattern_info["pattern"], text, re.IGNORECASE)
            for match in matches:
                med_text = match.group(1).strip()
                if self._is_valid_medication(med_text):
                    medications.append({
                        "text": med_text,
                        "type": pattern_info["type"],
                        "confidence": self._calculate_medication_confidence(med_text),
                        "normalized": self._normalize_medication(med_text)
                    })
        
        # Use entity matching
        words = word_tokenize(text.lower())
        for word in words:
            if word in self.medical_entities["medications"]:
                medications.append({
                    "text": word,
                    "type": "entity_match",
                    "confidence": 0.8,
                    "normalized": word
                })
        
        return self._deduplicate_entities(medications)
    
    async def _extract_conditions(self, text: str) -> List[Dict[str, Any]]:
        """Extract medical conditions from text"""
        conditions = []
        
        # Use pattern matching
        for pattern_info in self.condition_patterns:
            matches = re.finditer(pattern_info["pattern"], text, re.IGNORECASE)
            for match in matches:
                condition_text = match.group(1).strip()
                if self._is_valid_condition(condition_text):
                    conditions.append({
                        "text": condition_text,
                        "type": pattern_info["type"],
                        "confidence": self._calculate_condition_confidence(condition_text),
                        "normalized": self._normalize_condition(condition_text)
                    })
        
        # Use entity matching
        words = word_tokenize(text.lower())
        for word in words:
            if word in self.medical_entities["conditions"]:
                conditions.append({
                    "text": word,
                    "type": "entity_match",
                    "confidence": 0.8,
                    "normalized": word
                })
        
        return self._deduplicate_entities(conditions)
    
    async def _extract_body_parts(self, text: str) -> List[Dict[str, Any]]:
        """Extract body parts mentioned in text"""
        body_parts = []
        words = word_tokenize(text.lower())
        
        for word in words:
            if word in self.medical_entities["body_parts"]:
                body_parts.append({
                    "text": word,
                    "type": "body_part",
                    "confidence": 0.9,
                    "normalized": word
                })
        
        return self._deduplicate_entities(body_parts)
    
    async def _extract_temporal_information(self, text: str) -> List[Dict[str, Any]]:
        """Extract temporal information (duration, frequency, etc.)"""
        temporal_patterns = [
            {
                "pattern": r"(?:for|since|over|about)\s+(\d+)\s+(days?|weeks?|months?|years?)",
                "type": "duration"
            },
            {
                "pattern": r"(\d+)\s+times?\s+(?:a|per)\s+(day|week|month)",
                "type": "frequency"
            },
            {
                "pattern": r"(?:started|began|onset)\s+(.+?)(?:\.|,|$)",
                "type": "onset"
            },
            {
                "pattern": r"(?:every|each)\s+(\d+)\s+(hours?|days?)",
                "type": "interval"
            }
        ]
        
        temporal_info = []
        for pattern_info in temporal_patterns:
            matches = re.finditer(pattern_info["pattern"], text, re.IGNORECASE)
            for match in matches:
                temporal_info.append({
                    "text": match.group(0),
                    "type": pattern_info["type"],
                    "value": match.group(1) if match.groups() else match.group(0),
                    "confidence": 0.8
                })
        
        return temporal_info
    
    async def _extract_severity_indicators(self, text: str) -> Dict[str, Any]:
        """Extract severity and urgency indicators"""
        severity_keywords = {
            "severe": ["severe", "excruciating", "unbearable", "intense", "extreme"],
            "moderate": ["moderate", "noticeable", "significant", "considerable"],
            "mild": ["mild", "slight", "minor", "little", "small"],
            "urgent": ["urgent", "emergency", "immediate", "critical", "acute"],
            "chronic": ["chronic", "persistent", "ongoing", "continuous", "constant"]
        }
        
        severity_info = {
            "severity_level": "unknown",
            "urgency_level": "unknown",
            "keywords_found": [],
            "confidence": 0.0
        }
        
        text_lower = text.lower()
        max_confidence = 0.0
        
        for level, keywords in severity_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    severity_info["keywords_found"].append({
                        "keyword": keyword,
                        "category": level
                    })
                    
                    # Update severity/urgency level based on highest confidence match
                    confidence = 0.9 if keyword in ["severe", "urgent", "emergency"] else 0.7
                    if confidence > max_confidence:
                        max_confidence = confidence
                        if level in ["severe", "moderate", "mild"]:
                            severity_info["severity_level"] = level
                        elif level in ["urgent", "chronic"]:
                            severity_info["urgency_level"] = level
        
        severity_info["confidence"] = max_confidence
        return severity_info
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for better entity extraction"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Handle common abbreviations
        abbreviations = {
            "bp": "blood pressure",
            "hr": "heart rate",
            "temp": "temperature",
            "wt": "weight",
            "ht": "height",
            "sob": "shortness of breath",
            "cp": "chest pain",
            "n/v": "nausea and vomiting",
            "h/a": "headache"
        }
        
        for abbrev, full_form in abbreviations.items():
            text = re.sub(r'\b' + abbrev + r'\b', full_form, text)
        
        return text.strip()
    
    def _is_valid_symptom(self, text: str) -> bool:
        """Check if extracted text is a valid symptom"""
        # Filter out very short or common words
        if len(text) < 3:
            return False
        
        # Filter out common non-symptom words
        invalid_words = {"the", "and", "or", "but", "with", "for", "from", "very", "really"}
        if text.lower() in invalid_words:
            return False
        
        return True
    
    def _is_valid_medication(self, text: str) -> bool:
        """Check if extracted text is a valid medication"""
        if len(text) < 2:
            return False
        
        # Filter out common non-medication words
        invalid_words = {"the", "and", "or", "but", "with", "for", "from", "some", "any"}
        if text.lower() in invalid_words:
            return False
        
        return True
    
    def _is_valid_condition(self, text: str) -> bool:
        """Check if extracted text is a valid medical condition"""
        if len(text) < 3:
            return False
        
        # Filter out common non-condition words
        invalid_words = {"the", "and", "or", "but", "with", "for", "from", "very", "really"}
        if text.lower() in invalid_words:
            return False
        
        return True
    
    def _calculate_symptom_confidence(self, text: str) -> float:
        """Calculate confidence score for symptom extraction"""
        base_confidence = 0.6
        
        # Increase confidence if it matches known symptoms
        if text.lower() in self.medical_entities["symptoms"]:
            base_confidence += 0.3
        
        # Increase confidence based on text length and structure
        if len(text.split()) > 1:
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)
    
    def _calculate_medication_confidence(self, text: str) -> float:
        """Calculate confidence score for medication extraction"""
        base_confidence = 0.6
        
        if text.lower() in self.medical_entities["medications"]:
            base_confidence += 0.3
        
        # Check for medication-like patterns (ends with common suffixes)
        med_suffixes = ["in", "ol", "ide", "ate", "ine"]
        if any(text.lower().endswith(suffix) for suffix in med_suffixes):
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)
    
    def _calculate_condition_confidence(self, text: str) -> float:
        """Calculate confidence score for condition extraction"""
        base_confidence = 0.6
        
        if text.lower() in self.medical_entities["conditions"]:
            base_confidence += 0.3
        
        # Check for condition-like patterns
        condition_suffixes = ["itis", "osis", "emia", "pathy", "oma"]
        if any(text.lower().endswith(suffix) for suffix in condition_suffixes):
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)
    
    def _normalize_symptom(self, text: str) -> str:
        """Normalize symptom text"""
        # Convert to lowercase and lemmatize
        words = word_tokenize(text.lower())
        normalized_words = [self.lemmatizer.lemmatize(word) for word in words if word not in self.stop_words]
        return " ".join(normalized_words)
    
    def _normalize_medication(self, text: str) -> str:
        """Normalize medication text"""
        # Remove dosage information and normalize
        normalized = re.sub(r'\d+\s*(mg|mcg|g|ml)', '', text.lower())
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        return normalized
    
    def _normalize_condition(self, text: str) -> str:
        """Normalize condition text"""
        words = word_tokenize(text.lower())
        normalized_words = [self.lemmatizer.lemmatize(word) for word in words if word not in self.stop_words]
        return " ".join(normalized_words)
    
    def _deduplicate_entities(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate entities"""
        seen = set()
        deduplicated = []
        
        for entity in entities:
            key = (entity["normalized"], entity["type"])
            if key not in seen:
                seen.add(key)
                deduplicated.append(entity)
        
        # Sort by confidence
        return sorted(deduplicated, key=lambda x: x["confidence"], reverse=True)
    
    async def analyze_medical_text_structure(self, text: str) -> Dict[str, Any]:
        """Analyze the structure and content of medical text"""
        try:
            sentences = sent_tokenize(text)
            words = word_tokenize(text)
            
            analysis = {
                "sentence_count": len(sentences),
                "word_count": len(words),
                "avg_sentence_length": len(words) / len(sentences) if sentences else 0,
                "medical_density": await self._calculate_medical_density(text),
                "readability_score": await self._calculate_readability_score(text),
                "text_complexity": await self._assess_text_complexity(text),
                "key_phrases": await self._extract_key_phrases(text)
            }
            
            return analysis
            
        except Exception as e:
            return {
                "error": f"Text structure analysis failed: {str(e)}",
                "sentence_count": 0,
                "word_count": 0
            }
    
    async def _calculate_medical_density(self, text: str) -> float:
        """Calculate the density of medical terms in text"""
        words = word_tokenize(text.lower())
        medical_word_count = 0
        
        all_medical_terms = []
        for category in self.medical_entities.values():
            all_medical_terms.extend(category)
        
        for word in words:
            if word in all_medical_terms:
                medical_word_count += 1
        
        return medical_word_count / len(words) if words else 0.0
    
    async def _calculate_readability_score(self, text: str) -> float:
        """Calculate a simple readability score"""
        sentences = sent_tokenize(text)
        words = word_tokenize(text)
        
        if not sentences or not words:
            return 0.0
        
        avg_sentence_length = len(words) / len(sentences)
        
        # Simple readability score (lower is more readable)
        # Based on average sentence length
        if avg_sentence_length <= 10:
            return 0.9  # Very readable
        elif avg_sentence_length <= 15:
            return 0.7  # Readable
        elif avg_sentence_length <= 20:
            return 0.5  # Moderately readable
        else:
            return 0.3  # Difficult to read
    
    async def _assess_text_complexity(self, text: str) -> str:
        """Assess the complexity level of medical text"""
        medical_density = await self._calculate_medical_density(text)
        readability = await self._calculate_readability_score(text)
        
        if medical_density > 0.3 and readability < 0.5:
            return "high"
        elif medical_density > 0.2 or readability < 0.7:
            return "medium"
        else:
            return "low"
    
    async def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract key medical phrases from text"""
        # Simple key phrase extraction based on medical entity co-occurrence
        sentences = sent_tokenize(text)
        key_phrases = []
        
        for sentence in sentences:
            words = word_tokenize(sentence.lower())
            medical_words = []
            
            for word in words:
                for category in self.medical_entities.values():
                    if word in category:
                        medical_words.append(word)
            
            # If sentence contains multiple medical terms, consider it a key phrase
            if len(medical_words) >= 2:
                key_phrases.append(sentence.strip())
        
        return key_phrases[:5]  # Return top 5 key phrases
