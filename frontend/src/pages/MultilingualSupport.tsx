import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  LanguageIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  SpeakerWaveIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  medicalTerms?: { term: string; translation: string; explanation: string }[];
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const MultilingualSupport: React.FC = () => {
  const [activeTab, setActiveTab] = useState('translator');
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState<TranslationResponse | null>(null);

  const [translatorForm, setTranslatorForm] = useState({
    text: '',
    sourceLanguage: 'en',
    targetLanguage: 'hi',
    context: 'medical' as 'medical' | 'general'
  });

  const [chatForm, setChatForm] = useState({
    message: '',
    preferredLanguage: 'hi',
    medicalContext: true
  });

  const languages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' }
  ];

  const handleTranslate = async () => {
    if (!translatorForm.text.trim()) {
      toast.error('Please enter text to translate');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/translation/translate', translatorForm);
      setTranslation(response.data.data.translation);
      toast.success('Translation completed!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTranslatedMessage = async () => {
    if (!chatForm.message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      setLoading(true);
      await axios.post('/api/ai-agent/message', {
        content: chatForm.message,
        preferredLanguage: chatForm.preferredLanguage,
        medicalContext: chatForm.medicalContext,
        messageType: 'text'
      });

      toast.success('Message sent to AI assistant!');
      setChatForm({ ...chatForm, message: '' });
    } catch (error: any) {
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const getLanguageName = (code: string) => {
    const lang = languages.find(l => l.code === code);
    return lang ? `${lang.flag} ${lang.name}` : code;
  };

  const tabs = [
    { id: 'translator', name: 'Medical Translator', icon: LanguageIcon },
    { id: 'chat', name: 'AI Chat', icon: ChatBubbleLeftRightIcon },
    { id: 'languages', name: 'Supported Languages', icon: GlobeAltIcon }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-sapphire-600 via-sapphire-700 to-sapphire-800 dark:from-sapphire-700 dark:via-sapphire-800 dark:to-sapphire-900 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <LanguageIcon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Multilingual Healthcare Support</h1>
            <p className="text-sapphire-100">AI-powered translation for medical consultations and communications</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-sapphire-100 dark:bg-sapphire-900 rounded-xl">
              <GlobeAltIcon className="h-6 w-6 text-sapphire-700 dark:text-sapphire-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{languages.length}</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Languages Supported</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">24/7</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">AI Chat Available</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <SpeakerWaveIcon className="h-6 w-6 text-blue-700 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">Medical</p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Term Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-light-border dark:border-dark-border">
        <div className="border-b border-light-border dark:border-dark-border">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-sapphire-600 text-sapphire-700 dark:text-sapphire-300'
                      : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Medical Translator Tab */}
          {activeTab === 'translator' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Translation Form */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Translate Medical Text</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Source Language</label>
                      <select
                        value={translatorForm.sourceLanguage}
                        onChange={(e) => setTranslatorForm({ ...translatorForm, sourceLanguage: e.target.value })}
                        className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                      >
                        {languages.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.nativeName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Target Language</label>
                      <select
                        value={translatorForm.targetLanguage}
                        onChange={(e) => setTranslatorForm({ ...translatorForm, targetLanguage: e.target.value })}
                        className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                      >
                        {languages.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.nativeName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Context</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="medical"
                            checked={translatorForm.context === 'medical'}
                            onChange={(e) => setTranslatorForm({ ...translatorForm, context: e.target.value as 'medical' | 'general' })}
                            className="text-sapphire-600 focus:ring-sapphire-500"
                          />
                          <span className="ml-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">Medical Context</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="general"
                            checked={translatorForm.context === 'general'}
                            onChange={(e) => setTranslatorForm({ ...translatorForm, context: e.target.value as 'medical' | 'general' })}
                            className="text-sapphire-600 focus:ring-sapphire-500"
                          />
                          <span className="ml-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">General Context</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Text to Translate</label>
                      <textarea
                        value={translatorForm.text}
                        onChange={(e) => setTranslatorForm({ ...translatorForm, text: e.target.value })}
                        rows={4}
                        placeholder="Enter medical text to translate..."
                        className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all resize-none"
                      />
                    </div>

                    <button
                      onClick={handleTranslate}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-sapphire-600 to-sapphire-700 hover:from-sapphire-700 hover:to-sapphire-800 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <LanguageIcon className="h-5 w-5" />
                      )}
                      <span>{loading ? 'Translating...' : 'Translate'}</span>
                    </button>
                  </div>
                </div>

                {/* Translation Result */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Translation Result</h3>

                  {translation ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-sapphire-50 to-blue-50 dark:from-sapphire-900/30 dark:to-blue-900/30 rounded-xl p-4 border border-sapphire-200 dark:border-sapphire-700">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-sapphire-700 dark:text-sapphire-300">
                            {getLanguageName(translation.sourceLanguage)} → {getLanguageName(translation.targetLanguage)}
                          </span>
                          <span className="px-2 py-1 bg-sapphire-100 dark:bg-sapphire-800 text-sapphire-800 dark:text-sapphire-300 rounded-full text-xs">
                            {Math.round(translation.confidence * 100)}% confidence
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Original</h4>
                            <p className="text-light-text-primary dark:text-dark-text-primary">{translation.originalText}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">Translation</h4>
                            <p className="text-light-text-primary dark:text-dark-text-primary font-medium">{translation.translatedText}</p>
                          </div>
                        </div>
                      </div>

                      {translation.medicalTerms && translation.medicalTerms.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                          <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3">Medical Terms Explained</h4>
                          <div className="space-y-2">
                            {translation.medicalTerms.map((term, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium text-amber-900 dark:text-amber-200">{term.term}</span>
                                <span className="text-amber-700 dark:text-amber-300"> → {term.translation}</span>
                                <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">{term.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <LanguageIcon className="h-16 w-16 text-light-text-secondary dark:text-dark-text-secondary mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary mb-2">No Translation Yet</h3>
                      <p className="text-light-text-secondary dark:text-dark-text-secondary">Enter text above and click translate to see results</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Chat Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">AI Healthcare Assistant</h3>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">Chat with our AI in your preferred language with medical context awareness</p>

              <div className="max-w-2xl mx-auto space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Preferred Language</label>
                    <select
                      value={chatForm.preferredLanguage}
                      onChange={(e) => setChatForm({ ...chatForm, preferredLanguage: e.target.value })}
                      className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all"
                    >
                      {languages.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.nativeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Your Message</label>
                    <textarea
                      value={chatForm.message}
                      onChange={(e) => setChatForm({ ...chatForm, message: e.target.value })}
                      rows={4}
                      placeholder="Describe your symptoms or ask a health question..."
                      className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-xl bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-sapphire-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={chatForm.medicalContext}
                        onChange={(e) => setChatForm({ ...chatForm, medicalContext: e.target.checked })}
                        className="text-sapphire-600 focus:ring-sapphire-500 rounded"
                      />
                      <span className="ml-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">Medical context (better accuracy)</span>
                    </label>
                  </div>

                  <button
                    onClick={handleSendTranslatedMessage}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-sapphire-600 to-sapphire-700 hover:from-sapphire-700 hover:to-sapphire-800 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="h-5 w-5" />
                    )}
                    <span>{loading ? 'Sending...' : 'Send to AI Assistant'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Languages Tab */}
          {activeTab === 'languages' && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Supported Languages</h3>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">Our AI translation system supports these languages with medical terminology accuracy</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {languages.map((language) => (
                  <div key={language.code} className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-4 border border-light-border dark:border-dark-border hover:shadow-lg transition-all">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{language.flag}</span>
                      <div>
                        <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{language.name}</h4>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{language.nativeName}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-sapphire-100 dark:bg-sapphire-900 text-sapphire-800 dark:text-sapphire-300 rounded-full text-xs">
                        Medical Terms
                      </span>
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-full text-xs">
                        AI Chat
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultilingualSupport;
