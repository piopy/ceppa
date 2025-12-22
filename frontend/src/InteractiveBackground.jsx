import { useRef, useEffect } from 'react';

const InteractiveBackground = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width, height;
        let animationFrameId;
        
        // Configuration for the orb/fluid effect
        const orbs = [];
        const numOrbs = 15;
        
        // Mouse interaction
        const mouse = { x: undefined, y: undefined };

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        class Orb {
            constructor() {
                this.init();
            }

            init() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                // Soft blues and calm colors
                // #3b82f6 is roughly 217, 91%, 60%
                this.hue = 200 + Math.random() * 40; // 200-240 (Blues)
                this.size = Math.random() * 200 + 100;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.speedY = (Math.random() - 0.5) * 0.5;
                this.opacity = Math.random() * 0.2 + 0.1;
                this.baseSize = this.size;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Bounce off edges
                if (this.x < -this.size || this.x > width + this.size) this.speedX *= -1;
                if (this.y < -this.size || this.y > height + this.size) this.speedY *= -1;

                // Mouse interaction - move slightly away from mouse
                if (mouse.x !== undefined && mouse.y !== undefined) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const maxDist = 400;

                    if (distance < maxDist) {
                        const force = (maxDist - distance) / maxDist;
                        const angle = Math.atan2(dy, dx);
                        const moveX = Math.cos(angle) * force * 2;
                        const moveY = Math.sin(angle) * force * 2;
                        
                        this.x -= moveX;
                        this.y -= moveY;
                        
                        // Slightly increase size when near mouse
                       // this.size = this.baseSize + force * 20;
                    }
                }
            }

            draw() {
                ctx.beginPath();
                // Create gradient for soft edge
                const gradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, this.size
                );
                
                // HSLA for easy color manipulation
                gradient.addColorStop(0, `hsla(${this.hue}, 70%, 60%, ${this.opacity})`);
                gradient.addColorStop(1, `hsla(${this.hue}, 70%, 60%, 0)`);

                ctx.fillStyle = gradient;
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const initOrbs = () => {
            orbs.length = 0;
            for (let i = 0; i < numOrbs; i++) {
                orbs.push(new Orb());
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            
            // Fill background with base dark color to ensure trails don't build up too much if we want them, 
            // but here we want clean redraw
            // ctx.fillStyle = '#0f172a'; // Match root var --bg-color
            // ctx.fillRect(0, 0, width, height);

            orbs.forEach(orb => {
                orb.update();
                orb.draw();
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        
        const handleMouseLeave = () => {
             mouse.x = undefined;
             mouse.y = undefined;
        }

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);

        resize();
        initOrbs();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1, // Behind everything
                background: '#0f172a', // Fallback/Base color matching theme
                pointerEvents: 'none', // Let clicks pass through (though mousemove listener is on window)
            }}
        />
    );
};

export default InteractiveBackground;
