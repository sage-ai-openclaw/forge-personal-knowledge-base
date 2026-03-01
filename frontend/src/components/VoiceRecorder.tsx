import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderProps {
  noteId: number;
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

interface RecordingState {
  status: 'idle' | 'requesting' | 'recording' | 'processing' | 'error';
  errorMessage?: string;
  duration: number;
}

export function VoiceRecorder({ noteId, onTranscription, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>({
    status: 'idle',
    duration: 0,
  });
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255); // Normalize to 0-1
    
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startRecording = async () => {
    try {
      setState({ status: 'requesting', duration: 0 });
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      // Set up audio analysis for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start visualization
      updateAudioLevel();

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await processRecording();
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setState({
          status: 'error',
          errorMessage: 'Recording error occurred',
          duration: 0,
        });
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setState({ status: 'recording', duration: 0 });

      // Start duration timer
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setState({
        status: 'error',
        errorMessage: error instanceof Error 
          ? error.message 
          : 'Microphone access denied',
        duration: 0,
      });
    }
  };

  const stopRecording = () => {
    // Stop visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setAudioLevel(0);
  };

  const processRecording = async () => {
    if (audioChunksRef.current.length === 0) {
      setState({ status: 'idle', duration: 0 });
      return;
    }

    setState(prev => ({ ...prev, status: 'processing' }));

    try {
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording-${Date.now()}.webm`);
      formData.append('duration', String(state.duration));
      formData.append('transcribe', 'true');

      // Upload to server
      const response = await fetch(`/api/notes/${noteId}/voice`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload voice note');
      }

      const result = await response.json();
      
      if (result.transcription) {
        onTranscription(result.transcription);
      }

      setState({ status: 'idle', duration: 0 });
    } catch (error) {
      console.error('Failed to process recording:', error);
      setState({
        status: 'error',
        errorMessage: 'Failed to process recording',
        duration: 0,
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isRecording = state.status === 'recording';
  const isProcessing = state.status === 'processing';
  const isRequesting = state.status === 'requesting';
  const hasError = state.status === 'error';

  return (
    <div className="voice-recorder">
      <button
        className={`voice-record-btn ${isRecording ? 'recording' : ''} ${hasError ? 'error' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing || isRequesting}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
        type="button"
      >
        {isProcessing ? (
          <svg className="spinner" viewBox="0 0 24 24" width="20" height="20">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" 
              strokeDasharray="31.416" strokeDashoffset="10">
              <animateTransform attributeName="transform" type="rotate" 
                from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </circle>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            {isRecording ? (
              // Stop icon
              <rect x="6" y="6" width="12" height="12" rx="2" />
            ) : (
              // Microphone icon
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            )}
            {!isRecording && <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />}
          </svg>
        )}
        
        {isRecording && <span className="record-dot" />}
      </button>

      {(isRecording || isRequesting) && (
        <div className="recording-indicator">
          <div className="recording-timer">
            {isRequesting ? 'Requesting mic...' : formatDuration(state.duration)}
          </div>
          
          {isRecording && (
            <div className="waveform-container">
              <div className="waveform-bars">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{
                      height: `${Math.max(4, audioLevel * 40 * (0.5 + Math.random() * 0.5))}px`,
                      opacity: 0.3 + audioLevel * 0.7,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <span className="processing-text">Transcribing... ✨</span>
      )}

      {hasError && (
        <div className="recording-error">
          {state.errorMessage}
        </div>
      )}
    </div>
  );
}
