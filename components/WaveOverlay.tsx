import React, { useEffect, useRef } from 'react';

interface WaveOverlayProps {
    analyser: AnalyserNode | null;
}

const WaveOverlay: React.FC<WaveOverlayProps> = ({ analyser }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const amplitudeRef = useRef(0);
    const phaseRef = useRef(0);

    useEffect(() => {
        if (!analyser || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;

            analyser.getByteFrequencyData(dataArray);

            // Calculate overall volume (root mean square or average)
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // Target amplitude based on volume, with some smoothing (lerp)
            const targetAmplitude = 5 + (average / 255) * 60;
            amplitudeRef.current += (targetAmplitude - amplitudeRef.current) * 0.1;

            // Phase shifts constantly for flow
            phaseRef.current += 0.02 + (average / 255) * 0.1;

            ctx.clearRect(0, 0, width, height);

            // Draw 3 layers of waves for "premium" fluid look
            drawWave(ctx, width, height, phaseRef.current, amplitudeRef.current, 'rgba(244, 63, 94, 0.4)', 1.0, 4); // Rose
            drawWave(ctx, width, height, phaseRef.current * 0.8, amplitudeRef.current * 0.7, 'rgba(251, 191, 36, 0.3)', 1.2, 3); // Amber
            drawWave(ctx, width, height, phaseRef.current * 1.2, amplitudeRef.current * 0.4, 'rgba(168, 85, 247, 0.2)', 0.8, 5); // Purple

            requestAnimationFrame(render);
        };

        const drawWave = (
            ctx: CanvasRenderingContext2D,
            width: number,
            height: number,
            phase: number,
            amp: number,
            color: string,
            frequency: number,
            points: number
        ) => {
            ctx.beginPath();
            ctx.moveTo(0, height);

            const step = width / 50;
            for (let x = 0; x <= width; x += step) {
                // Sine wave formula: y = sin(x * freq + phase) * amp
                const angle = (x / width) * Math.PI * 2 * frequency + phase;
                const y = height / 2 + Math.sin(angle) * amp;

                ctx.lineTo(x, y);
            }

            ctx.lineTo(width, height);
            ctx.fillStyle = color;
            ctx.fill();
        };

        render();
    }, [analyser]);

    return (
        <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none opacity-60 mix-blend-screen"
        />
    );
};

export default WaveOverlay;
