import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2, MessageCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

function App() {
  const [isListening, setIsListening] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(7)}`);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        setCurrentTranscript(text);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        if (event.results[last].isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            if (text.trim().length > 0) {
              handleUserMessage(text);
            }
          }, 800);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech' && isCallActive) {
          setTimeout(() => {
            if (isCallActive && isListening) {
              try {
                recognitionRef.current?.start();
              } catch (e) {
                console.log('Recognition already started');
              }
            }
          }, 1000);
        }
      };

      recognitionRef.current.onend = () => {
        if (isCallActive && isListening && !isSpeaking) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log('Recognition already started');
          }
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [isCallActive, isListening, isSpeaking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUserMessage = async (text: string) => {
    if (!text.trim()) return;

    setCurrentTranscript('');
    setIsProcessing(true);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
    }

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hotel-voice-assistant`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          userMessage: text,
          sessionId: sessionId,
          conversationHistory: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const botResponse: Message = {
        role: 'bot',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botResponse]);
      await speak(data.response);
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        role: 'bot',
        content: "I apologize, but I'm having trouble processing that. Could you please repeat?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      await speak(errorMessage.content);
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (synthRef.current) {
        synthRef.current.cancel();
        setIsSpeaking(true);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(voice =>
          voice.name.includes('Google') ||
          voice.name.includes('Enhanced') ||
          voice.name.includes('Premium')
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          setIsSpeaking(false);
          setTimeout(() => {
            if (isCallActive && isListening) {
              try {
                recognitionRef.current?.start();
              } catch (e) {
                console.log('Recognition already started');
              }
            }
            resolve();
          }, 500);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };

        synthRef.current.speak(utterance);
      } else {
        resolve();
      }
    });
  };

  const startCall = async () => {
    setIsCallActive(true);
    setIsListening(true);
    setMessages([]);

    const greeting = "Hello! Welcome to Grand Plaza Hotel. How may I assist you today?";
    const botMessage: Message = {
      role: 'bot',
      content: greeting,
      timestamp: new Date(),
    };
    setMessages([botMessage]);

    await speak(greeting);
  };

  const endCall = () => {
    setIsCallActive(false);
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setCurrentTranscript('');
    setIsSpeaking(false);
  };

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.log('Recognition already started');
      }
      setIsListening(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-2xl mb-4 animate-pulse-slow">
            <Phone className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">Grand Plaza Hotel</h1>
          <p className="text-blue-200 text-lg">AI Voice Concierge • Available 24/7</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 px-6 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isCallActive ? (
                  <>
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                    <span className="text-green-300 font-semibold">Call Active</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-300 font-semibold">Ready to Connect</span>
                  </>
                )}
              </div>
              {isCallActive && (
                <div className="flex items-center gap-2 text-blue-200 text-sm">
                  <MessageCircle className="w-4 h-4" />
                  <span>{messages.length} messages</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6 h-[400px] overflow-y-auto custom-scrollbar">
              {!isCallActive ? (
                <div className="text-center py-12">
                  <p className="text-white/70 text-lg mb-8">Press the call button to speak with our AI concierge</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    <div className="bg-blue-500/20 backdrop-blur-sm p-5 rounded-2xl border border-blue-400/30">
                      <h3 className="font-semibold text-blue-200 mb-3 flex items-center gap-2">
                        <span className="text-2xl">🏨</span>
                        I can help with:
                      </h3>
                      <ul className="text-sm text-blue-100/80 space-y-2">
                        <li>• Room reservations & availability</li>
                        <li>• Check-in/out procedures</li>
                        <li>• Room service & dining</li>
                        <li>• Pricing & special offers</li>
                      </ul>
                    </div>
                    <div className="bg-blue-500/20 backdrop-blur-sm p-5 rounded-2xl border border-blue-400/30">
                      <h3 className="font-semibold text-blue-200 mb-3 flex items-center gap-2">
                        <span className="text-2xl">✨</span>
                        Ask me about:
                      </h3>
                      <ul className="text-sm text-blue-100/80 space-y-2">
                        <li>• Hotel amenities & facilities</li>
                        <li>• Spa & fitness center</li>
                        <li>• Parking & transportation</li>
                        <li>• Pet-friendly policies</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 animate-fade-in ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'bot' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                          <Volume2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-md p-4 rounded-2xl shadow-lg ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-tr-sm border border-slate-600'
                            : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tl-sm'
                        }`}
                      >
                        <p className="leading-relaxed">{message.content}</p>
                        <span className="text-xs opacity-60 mt-2 block">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                          <Mic className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  ))}

                  {currentTranscript && (
                    <div className="flex gap-3 justify-end animate-fade-in">
                      <div className="max-w-md p-4 rounded-2xl rounded-tr-sm shadow-lg bg-slate-600/50 backdrop-blur-sm text-white border border-slate-500">
                        <p className="leading-relaxed opacity-75">{currentTranscript}</p>
                      </div>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2 text-blue-200 bg-blue-500/20 px-4 py-2 rounded-full backdrop-blur-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Thinking...</span>
                      </div>
                    </div>
                  )}

                  {isSpeaking && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 text-blue-200 bg-blue-500/20 px-4 py-2 rounded-full backdrop-blur-sm">
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        <span className="text-sm font-medium">Speaking...</span>
                      </div>
                    </div>
                  )}

                  {isListening && !currentTranscript && !isProcessing && !isSpeaking && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-3 text-green-300 bg-green-500/20 px-4 py-2 rounded-full backdrop-blur-sm">
                        <div className="flex gap-1">
                          <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-6 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm font-medium">Listening...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
              {!isCallActive ? (
                <button
                  onClick={startCall}
                  className="group relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full shadow-2xl hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-110"
                >
                  <Phone className="w-8 h-8" />
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleListening}
                    disabled={isSpeaking || isProcessing}
                    className={`flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-all duration-300 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isListening
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/50'
                        : 'bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white'
                    }`}
                  >
                    {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={endCall}
                    className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full shadow-2xl hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-110"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </button>
                </>
              )}
            </div>

            {!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
              <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-400/30 rounded-xl backdrop-blur-sm">
                <p className="text-sm text-yellow-200 text-center">
                  Voice recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-blue-200/60 text-sm">
          <p>Powered by AI • Natural language processing • Real-time voice interaction</p>
        </div>
      </div>
    </div>
  );
}

export default App;
