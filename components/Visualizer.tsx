import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear with transparency
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 2) * 1.5; // Slight boost for visibility

        // Gradient: Rose to Amber
        const gradient = ctx.createLinearGradient(0, HEIGHT - barHeight, 0, HEIGHT);
        gradient.addColorStop(0, '#fca5a5'); // lighter rose/peach top
        gradient.addColorStop(0.5, '#f43f5e'); // rose-500
        gradient.addColorStop(1, '#d97706'); // amber-600

        ctx.fillStyle = gradient;

        // Rounded caps for bars (simulated by clearing corner or just simple rect)
        ctx.fillRect(x, HEIGHT - barHeight, barWidth - 1, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  }, [analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={100}
      className="w-full h-24 rounded-xl opacity-90"
    />
  );
};

export default Visualizer;