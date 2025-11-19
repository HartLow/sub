document.addEventListener('DOMContentLoaded', () => {
    setupAudio();
});

function setupAudio() {
    const audio = document.getElementById('bg-music');
    const video = document.getElementById('bg-video'); // Video nền
    const playBtn = document.getElementById('play-btn');
    const mobilePlayBtn = document.getElementById('mobile-play-btn'); // Nút play mobile
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const yuAvatar = document.querySelector('.character:nth-child(2) .avatar-frame');
    const daisyAvatar = document.querySelector('.character:nth-child(1) .avatar-frame');
    
    let audioContext, analyser, source;
    let isPlaying = false;
    let threeApp = null; // Object to manage Three.js

    // Define singing timeline (in seconds)
    const timeline = [
        { start: 2, end: 11.88, singer: 'yu' },
        { start: 11.88, end: 21.59, singer: 'daisy' },
        { start: 21.59, end: 31, singer: 'yu' },
        { start: 31, end: 40, singer: 'daisy' },
        { start: 40, end: 50, singer: 'yu' },
        { start: 50, end: 60, singer: 'daisy' },
        { start: 60, end: 79, singer: 'both' }
    ];

    // Resize canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight * 0.3; // 30% height
        if (threeApp) threeApp.resize();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Init Three.js background
    initThreeJS();

    function togglePlay() {
        if (!audioContext) {
            initAudioContext();
        }

        if (audio.paused) {
            audio.play();
            if (video) video.play(); // Chạy video cùng lúc
            updatePlayButtons(true);
            isPlaying = true;
        } else {
            audio.pause();
            if (video) video.pause(); // Dừng video cùng lúc
            updatePlayButtons(false);
            isPlaying = false;
        }
    }

    function updatePlayButtons(playing) {
        const icon = playing 
            ? '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
        
        if(playBtn) playBtn.innerHTML = icon;
        if(mobilePlayBtn) mobilePlayBtn.innerHTML = icon;
    }

    if(playBtn) playBtn.addEventListener('click', togglePlay);
    if(mobilePlayBtn) mobilePlayBtn.addEventListener('click', togglePlay);

    // Đồng bộ video với audio
    if (video) {
        // Khi audio kết thúc
        audio.addEventListener('ended', () => {
            video.pause();
            video.currentTime = 0; // Reset video về đầu
            isPlaying = false;
            updatePlayButtons(false);
        });

        // Khi tua audio
        audio.addEventListener('seeked', () => {
            video.currentTime = audio.currentTime;
        });

        // Đồng bộ thời gian định kỳ (để tránh bị lệch)
        setInterval(() => {
            if (!audio.paused && Math.abs(video.currentTime - audio.currentTime) > 0.5) {
                video.currentTime = audio.currentTime;
            }
        }, 1000);
    }

    function initAudioContext() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 256;
        
        drawVisualizer();
    }

    function drawVisualizer() {
        let intensity = 0;
        let bassIntensity = 0;

        if (isPlaying) {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);

            // Calculate average intensity (General)
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            intensity = sum / bufferLength / 255; // Normalize 0-1

            // Calculate Bass Intensity (Low frequencies - first 10%)
            let bassSum = 0;
            let bassCount = Math.floor(bufferLength * 0.1); 
            for (let i = 0; i < bassCount; i++) {
                bassSum += dataArray[i];
            }
            bassIntensity = bassSum / bassCount / 255; // Normalize 0-1

            // Update Three.js background
            if (threeApp) threeApp.update(dataArray, intensity, bassIntensity);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                // Tạo gradient cầu vồng cho sóng nhạc
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, `hsl(${i / bufferLength * 360}, 100%, 50%)`); // Màu thay đổi theo vị trí cột
                gradient.addColorStop(1, `hsl(${i / bufferLength * 360}, 100%, 80%)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, 5);
                ctx.fill();

                x += barWidth + 1;
            }
        } else {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             // Vẫn render Three.js khi pause nhưng không có dữ liệu nhạc
             if (threeApp) threeApp.update(null, 0, 0);
        }
        
        // Update CSS variables
        document.body.style.setProperty('--music-intensity', intensity);
        document.body.style.setProperty('--bass-intensity', bassIntensity);

        // Calculate Shake (Rung lắc) based on Bass
        // Chỉ rung khi bass mạnh (> 0.5)
        const shakeAmount = bassIntensity > 0.5 ? (bassIntensity - 0.5) * 20 : 0;
        const shakeX = (Math.random() - 0.5) * shakeAmount;
        const shakeY = (Math.random() - 0.5) * shakeAmount;
        
        document.body.style.setProperty('--shake-x', `${shakeX}px`);
        document.body.style.setProperty('--shake-y', `${shakeY}px`);

        // Update singer status based on current time
        updateSingerStatus();

        requestAnimationFrame(drawVisualizer);
    }

    function updateSingerStatus() {
        const currentTime = audio.currentTime;
        let activeSinger = null;

        // Find active singer
        for (const segment of timeline) {
            if (currentTime >= segment.start && currentTime < segment.end) {
                activeSinger = segment.singer;
                break;
            }
        }

        // Update avatar classes and CSS variables
        if (activeSinger === 'yu') {
            yuAvatar.classList.add('singing');
            daisyAvatar.classList.remove('singing');
            document.body.style.setProperty('--yu-singing', '1');
            document.body.style.setProperty('--daisy-singing', '0');
            document.body.style.setProperty('--both-singing', '0');
        } else if (activeSinger === 'daisy') {
            yuAvatar.classList.remove('singing');
            daisyAvatar.classList.add('singing');
            document.body.style.setProperty('--yu-singing', '0');
            document.body.style.setProperty('--daisy-singing', '1');
            document.body.style.setProperty('--both-singing', '0');
        } else if (activeSinger === 'both') {
            yuAvatar.classList.add('singing');
            daisyAvatar.classList.add('singing');
            document.body.style.setProperty('--yu-singing', '1');
            document.body.style.setProperty('--daisy-singing', '1');
            document.body.style.setProperty('--both-singing', '1');
        } else {
            yuAvatar.classList.remove('singing');
            daisyAvatar.classList.remove('singing');
            document.body.style.setProperty('--yu-singing', '0');
            document.body.style.setProperty('--daisy-singing', '0');
            document.body.style.setProperty('--both-singing', '0');
        }
    }

    function initThreeJS() {
        const container = document.getElementById('three-bg');
        if (!container) return;

        const scene = new THREE.Scene();
        // Fog để tạo chiều sâu
        scene.fog = new THREE.FogExp2(0x000000, 0.001);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 100;
        camera.position.y = 20;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Tạo texture đom đóm (glow) bằng Canvas - Màu trắng cơ bản để dễ tint màu
        function createFireflyTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // Tâm trắng
            gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)'); // Trắng mờ
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)'); // Viền mờ
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Trong suốt
            context.fillStyle = gradient;
            context.fillRect(0, 0, 32, 32);
            const texture = new THREE.CanvasTexture(canvas);
            return texture;
        }

        // Tạo hệ thống hạt (Particles) - Đom đóm
        const particleCount = 4000; // Tăng số lượng hạt lên nhiều hơn
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const scales = new Float32Array(particleCount);
        
        // Lưu vị trí gốc để hạt không bị trôi mất
        const originalX = new Float32Array(particleCount);
        const originalY = new Float32Array(particleCount);
        const originalZ = new Float32Array(particleCount);
        
        const phases = new Float32Array(particleCount); // Để tạo nhấp nháy lệch pha
        const speeds = new Float32Array(particleCount); // Tốc độ bay khác nhau
        const colors = new Float32Array(particleCount * 3); // Màu riêng cho từng hạt

        const colorObj = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            const x = (Math.random() - 0.5) * 800; // Mở rộng phạm vi
            const z = (Math.random() - 0.5) * 800;
            const y = (Math.random() - 0.5) * 400;
            
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            
            originalX[i] = x;
            originalY[i] = y;
            originalZ[i] = z;
            
            scales[i] = Math.random() * 2 + 0.5; // Kích thước ngẫu nhiên
            phases[i] = Math.random() * Math.PI * 2;
            speeds[i] = Math.random() * 0.02 + 0.005;

            // Màu cam chủ đạo (Hue từ 0.05 đến 0.12 - Cam đỏ đến Cam vàng)
            const hue = 0.05 + Math.random() * 0.07; 
            colorObj.setHSL(hue, 1.0, 0.6);
            colors[i * 3] = colorObj.r;
            colors[i * 3 + 1] = colorObj.g;
            colors[i * 3 + 2] = colorObj.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
        geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Material đom đóm chân thực
        const material = new THREE.PointsMaterial({
            vertexColors: true, // Sử dụng màu của từng hạt
            map: createFireflyTexture(),
            size: 5, // Tăng kích thước hạt
            transparent: true,
            opacity: 1.0, // Tăng độ rõ
            blending: THREE.AdditiveBlending,
            depthWrite: false, // Để các hạt chồng lên nhau đẹp hơn
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        // Hàm update được gọi từ vòng lặp chính
        threeApp = {
            update: (dataArray, intensity, bassIntensity) => {
                const positions = particles.geometry.attributes.position.array;
                const scales = particles.geometry.attributes.scale.array;
                const phases = particles.geometry.attributes.phase.array;
                const speeds = particles.geometry.attributes.speed.array;
                const colors = particles.geometry.attributes.color.array;
                
                const time = Date.now() * 0.001;

                // Xoay nhẹ toàn bộ hệ thống
                particles.rotation.y += 0.0005;

                // Biến đổi hạt theo nhạc
                if (dataArray) {
                    for (let i = 0; i < particleCount; i++) {
                        // Tính toán vị trí mục tiêu dựa trên vị trí gốc + dao động
                        // Giúp hạt không bị trôi mất dần (Fix lỗi mất hạt)
                        const oscX = Math.sin(time * speeds[i] + phases[i]) * 20;
                        const oscY = Math.cos(time * speeds[i] * 0.5 + phases[i]) * 20;
                        const oscZ = Math.sin(time * speeds[i] * 0.3 + phases[i]) * 20;

                        const targetX = originalX[i] + oscX;
                        const targetZ = originalZ[i] + oscZ;

                        // Phản ứng với nhạc
                        const index = i % dataArray.length;
                        const audioValue = dataArray[index] / 255;

                        // Nhấp nháy theo nhạc + pha riêng
                        // Bass càng mạnh, đom đóm càng bay cao và sáng
                        const floatOffset = Math.sin(time * 2 + phases[i]) * 10;
                        const musicLift = audioValue * 60 * bassIntensity; // Tăng độ nảy
                        
                        // Lerp vị trí để mượt mà
                        const targetY = originalY[i] + floatOffset + musicLift;
                        
                        positions[i * 3] += (targetX - positions[i * 3]) * 0.05;
                        positions[i * 3 + 1] += (targetY - positions[i * 3 + 1]) * 0.1;
                        positions[i * 3 + 2] += (targetZ - positions[i * 3 + 2]) * 0.05;
                        
                        // Scale hạt: Nhấp nháy tự nhiên + theo nhạc
                        const naturalPulse = Math.sin(time * 3 + phases[i]) * 0.3 + 1;
                        scales[i] = naturalPulse * (1 + audioValue * 4); 

                        // Đổi màu theo nhạc nhưng giữ tông CAM (Orange)
                        // Hue dao động quanh màu cam (0.08), khi nhạc mạnh thì sáng hơn (lightness tăng)
                        const baseHue = 0.06 + (audioValue * 0.05); // 0.06 (Cam đỏ) -> 0.11 (Cam vàng)
                        const lightness = 0.5 + audioValue * 0.5; // Sáng hơn khi nhạc mạnh
                        
                        colorObj.setHSL(baseHue, 1.0, lightness);
                        
                        colors[i * 3] = colorObj.r;
                        colors[i * 3 + 1] = colorObj.g;
                        colors[i * 3 + 2] = colorObj.b;
                    }
                    particles.geometry.attributes.position.needsUpdate = true;
                    particles.geometry.attributes.scale.needsUpdate = true;
                    particles.geometry.attributes.color.needsUpdate = true;
                } else {
                    // Chế độ chờ (Idle): Bay lượn nhẹ nhàng quanh vị trí gốc
                    for (let i = 0; i < particleCount; i++) {
                        const oscX = Math.sin(time * speeds[i] + phases[i]) * 10;
                        const oscY = Math.cos(time * speeds[i] * 0.5 + phases[i]) * 10;
                        const oscZ = Math.sin(time * speeds[i] * 0.3 + phases[i]) * 10;

                        const targetX = originalX[i] + oscX;
                        const targetY = originalY[i] + oscY;
                        const targetZ = originalZ[i] + oscZ;

                        positions[i * 3] += (targetX - positions[i * 3]) * 0.02;
                        positions[i * 3 + 1] += (targetY - positions[i * 3 + 1]) * 0.02;
                        positions[i * 3 + 2] += (targetZ - positions[i * 3 + 2]) * 0.02;
                        
                        // Nhấp nháy nhẹ
                        scales[i] = Math.sin(time * 2 + phases[i]) * 0.5 + 1;
                        
                        // Màu cam tĩnh
                        colorObj.setHSL(0.08, 1.0, 0.6);
                        colors[i * 3] = colorObj.r;
                        colors[i * 3 + 1] = colorObj.g;
                        colors[i * 3 + 2] = colorObj.b;
                    }
                    particles.geometry.attributes.position.needsUpdate = true;
                    particles.geometry.attributes.scale.needsUpdate = true;
                    particles.geometry.attributes.color.needsUpdate = true;
                }

                // Camera di chuyển nhẹ nhàng như đang trôi
                camera.position.x = Math.sin(time * 0.1) * 30;
                camera.position.y = 20 + Math.cos(time * 0.15) * 15;
                camera.lookAt(scene.position);

                renderer.render(scene, camera);
            },
            resize: () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        };

        // Render loop ban đầu (khi chưa play nhạc)
        function animate() {
            if (!isPlaying) {
                threeApp.update(null, 0, 0);
                requestAnimationFrame(animate);
            }
        }
        animate();
    }
}

