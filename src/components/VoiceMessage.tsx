import React, { useState } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';

interface VoiceMessageProps {
  text: string;
  /** Optional: language for this specific message */
  lang?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  text,
  lang = 'en-US',
  size = 'sm',
}) => {
  const [isThisPlaying, setIsThisPlaying] = useState(false);
  const voice = useVoice({ lang });

  if (!voice.ttsSupported) return null;

  const dim = size === 'sm' ? 26 : 32;
  const iconDim = size === 'sm' ? 11 : 14;

  const handleClick = () => {
    if (isThisPlaying) {
      voice.stopSpeaking();
      setIsThisPlaying(false);
    } else {
      // Stop any other playing message first
      voice.stopSpeaking();
      setIsThisPlaying(true);
      voice.speak(text);
      // Listen for end — poll isSpeaking
      const check = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          setIsThisPlaying(false);
          clearInterval(check);
        }
      }, 200);
    }
  };

  return (
    <button
      onClick={handleClick}
      title={isThisPlaying ? 'Stop' : 'Read aloud'}
      className="voice-message-btn"
      style={{
        width: dim, height: dim, borderRadius: 6,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: isThisPlaying ? 'rgba(99,102,241,0.15)' : 'transparent',
        border: `1px solid ${isThisPlaying ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
        color: isThisPlaying ? '#818cf8' : '#475569',
        cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
        verticalAlign: 'middle',
      }}
    >
      {isThisPlaying
        ? <Square  style={{ width: iconDim, height: iconDim }} />
        : <Volume2 style={{ width: iconDim, height: iconDim }} />
      }
    </button>
  );
};

export default VoiceMessage;
