/**
 * LUCAS SOUZA — PORTFÓLIO PESSOAL
 * Script principal:
 * 1. Planeta 3D WebGL com Three.js (Superfície celular Voronoi + relevo fractal realista, bump map de alta fidelidade, anéis orbitais, satélites e iluminação dramática)
 * 2. Sistema de Expansão/Zoom FLIP entre o Menu Superior e os Cartões Inferiores
 * 3. Gerenciamento de Estado da Navegação (Início, Sobre Mim, Projetos) com suporte a deep-link por Hash
 * 4. Microinterações nos Projetos e Acessibilidade Completa
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Preferência de movimento reduzido
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =========================================================================
  // 1. ELEMENTO VISUAL PRINCIPAL: PLANETA 3D COM THREE.JS
  // =========================================================================
  initPlanet3D();

  function initPlanet3D() {
    const canvas = document.getElementById('planet-canvas');
    const container = document.getElementById('planet-container');
    const shadowEl = document.getElementById('planet-shadow');

    if (!canvas || !container || typeof THREE === 'undefined') {
      console.warn('Three.js não disponível. Executando modo alternativo.');
      return;
    }

    // Cena e Câmera
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 7.6);

    // Renderizador WebGL de alta precisão
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    // Grupo de rotação geral do planeta e órbitas
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Inclinação realista do eixo orbital (~22 graus)
    worldGroup.rotation.z = 0.36;
    worldGroup.rotation.x = 0.16;

    // -----------------------------------------------------------------------
    // GERAÇÃO PROCEDURAL REALISTA DA SUPERFÍCIE (VORONOI + FRACTAL 3D)
    // -----------------------------------------------------------------------
    const { surfaceTexture, bumpTexture } = generatePhotorealisticPlanetMaps();

    const planetRadius = 2.05;
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 64);

    const planetMat = new THREE.MeshStandardMaterial({
      map: surfaceTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.075,
      roughness: 0.76,
      metalness: 0.22,
      color: new THREE.Color(0xdce5f5)
    });

    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    worldGroup.add(planetMesh);

    // -----------------------------------------------------------------------
    // HALO ATMOSFÉRICO SUTIL (FRESNEL CYAN/SLATE BLUE)
    // -----------------------------------------------------------------------
    const atmosphereGeo = new THREE.SphereGeometry(planetRadius * 1.022, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.70 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.24, 0.72, 0.98, intensity * 0.75);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    worldGroup.add(atmosphereMesh);

    // -----------------------------------------------------------------------
    // ANÉIS ORBITAIS TRIDIMENSIONAIS (3 ÓRBITAS ELÍPTICAS INCLINADAS)
    // -----------------------------------------------------------------------
    const orbitGroup = new THREE.Group();
    worldGroup.add(orbitGroup);

    const orbitConfigs = [
      { rx: 3.75, ry: 1.42, tiltX: 0.46, tiltZ: -0.44, color: 0x94a3b8, opacity: 0.48 },
      { rx: 4.35, ry: 1.68, tiltX: 0.56, tiltZ: 0.36,  color: 0x64748b, opacity: 0.42 },
      { rx: 3.15, ry: 1.18, tiltX: 0.30, tiltZ: 0.16,  color: 0x94a3b8, opacity: 0.38 }
    ];

    orbitConfigs.forEach((config) => {
      const curve = new THREE.EllipseCurve(
        0, 0,
        config.rx, config.ry,
        0, 2 * Math.PI,
        false,
        0
      );
      const points = curve.getPoints(128);
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
        points.map(p => new THREE.Vector3(p.x, 0, p.y))
      );

      const orbitMaterial = new THREE.LineBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: config.opacity
      });

      const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
      orbitLine.rotation.x = config.tiltX;
      orbitLine.rotation.z = config.tiltZ;
      orbitGroup.add(orbitLine);
    });

    // -----------------------------------------------------------------------
    // SATÉLITES PEQUENOS ORBITANDO EM VELOCIDADES DIFERENTES
    // -----------------------------------------------------------------------
    const satellites = [
      {
        mesh: createSatellite(0.18, 0x1e293b),
        orbitIndex: 0,
        speed: 0.007,
        angle: 0.3
      },
      {
        mesh: createSatellite(0.13, 0x334155),
        orbitIndex: 1,
        speed: 0.012,
        angle: 2.3
      },
      {
        mesh: createSatellite(0.19, 0x0f172a),
        orbitIndex: 2,
        speed: 0.005,
        angle: 4.5
      },
      {
        mesh: createSatellite(0.11, 0x475569),
        orbitIndex: 0,
        speed: 0.009,
        angle: 3.4
      }
    ];

    satellites.forEach(sat => worldGroup.add(sat.mesh));

    function createSatellite(radius, colorHex) {
      const geo = new THREE.SphereGeometry(radius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.65,
        metalness: 0.3
      });
      return new THREE.Mesh(geo, mat);
    }

    // -----------------------------------------------------------------------
    // PONTOS DE LUZ / POEIRA CÓSMICA AO REDOR DO PLANETA
    // -----------------------------------------------------------------------
    const particleCount = 80;
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const r = 2.4 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      particlePositions[i * 3]     = r * Math.cos(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi);
      particlePositions[i * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.038,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    worldGroup.add(particles);

    // -----------------------------------------------------------------------
    // ILUMINAÇÃO DRAMÁTICA (LUZ CHAVE TOP-RIGHT + FILL + RIM)
    // -----------------------------------------------------------------------
    const keyLight = new THREE.DirectionalLight(0xe4f1ff, 2.2);
    keyLight.position.set(5.0, 3.5, 4.2);
    scene.add(keyLight);

    const ambientLight = new THREE.AmbientLight(0x0a121e, 0.45);
    scene.add(ambientLight);

    const rimLight = new THREE.DirectionalLight(0x2563eb, 0.85);
    rimLight.position.set(-4.0, -2.5, -3.5);
    scene.add(rimLight);

    // -----------------------------------------------------------------------
    // INTERATIVIDADE COM CURSOR E CLIQUE
    // -----------------------------------------------------------------------
    let baseSpeed = prefersReducedMotion ? 0 : 0.0035;
    let currentSpeed = baseSpeed;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let isPulseActive = false;
    let pulseTime = 0;

    window.addEventListener('pointermove', (e) => {
      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
      const mouseY = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2);

      targetTiltY = Math.max(-0.35, Math.min(0.35, mouseX * 0.45));
      targetTiltX = Math.max(-0.25, Math.min(0.25, mouseY * 0.35));
    });

    document.addEventListener('mouseleave', () => {
      targetTiltX = 0;
      targetTiltY = 0;
    });

    container.addEventListener('click', () => {
      if (isPulseActive) return;
      isPulseActive = true;
      pulseTime = 0;

      keyLight.intensity = 3.2;
      currentSpeed = 0.015;
      atmosphereMesh.scale.set(1.06, 1.06, 1.06);

      if (shadowEl) {
        shadowEl.style.transform = 'scale(1.15)';
        shadowEl.style.opacity = '0.95';
      }
    });

    // -----------------------------------------------------------------------
    // LOOP DE ANIMAÇÃO
    // -----------------------------------------------------------------------
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // Rotação contínua lenta do planeta no próprio eixo
      planetMesh.rotation.y += currentSpeed;

      // Parallax suave com amortecimento lerp
      currentTiltX += (targetTiltX - currentTiltX) * 0.05;
      currentTiltY += (targetTiltY - currentTiltY) * 0.05;

      worldGroup.rotation.x = 0.16 + currentTiltX;
      worldGroup.rotation.y = currentTiltY;

      // Movimento orbital independente dos satélites
      satellites.forEach(sat => {
        sat.angle += sat.speed;
        const cfg = orbitConfigs[sat.orbitIndex];

        const px = Math.cos(sat.angle) * cfg.rx;
        const pz = Math.sin(sat.angle) * cfg.ry;

        const v = new THREE.Vector3(px, 0, pz);
        v.applyAxisAngle(new THREE.Vector3(1, 0, 0), cfg.tiltX);
        v.applyAxisAngle(new THREE.Vector3(0, 0, 1), cfg.tiltZ);

        sat.mesh.position.copy(v);
      });

      // Partículas em rotação sutil
      particles.rotation.y += 0.0008;

      // Desaceleração suave do pulso de clique
      if (isPulseActive) {
        pulseTime += delta;
        currentSpeed += (baseSpeed - currentSpeed) * 0.04;
        keyLight.intensity += (2.2 - keyLight.intensity) * 0.05;
        atmosphereMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);

        if (pulseTime > 1.8) {
          isPulseActive = false;
          currentSpeed = baseSpeed;
          keyLight.intensity = 2.2;
          atmosphereMesh.scale.set(1, 1, 1);
          if (shadowEl) {
            shadowEl.style.transform = '';
            shadowEl.style.opacity = '';
          }
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    // Redimensionamento
    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  // -------------------------------------------------------------------------
  // GERADOR PROCEDURAL REALISTA COM VORONOI 3D E FRACTAIS ORGÂNICOS
  // -------------------------------------------------------------------------
  function generatePhotorealisticPlanetMaps() {
    const width = 1024;
    const height = 512;

    const surfCanvas = document.createElement('canvas');
    surfCanvas.width = width;
    surfCanvas.height = height;
    const sCtx = surfCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d');

    const sImg = sCtx.createImageData(width, height);
    const bImg = bCtx.createImageData(width, height);

    // 16 Centros celulares 3D na esfera para relevo tectônico e crateras naturais
    const cellCenters = [
      { x:  0.85, y:  0.35, z:  0.38, r: 0.35, crater: true },
      { x: -0.72, y:  0.55, z:  0.41, r: 0.40, crater: false },
      { x:  0.25, y: -0.80, z:  0.53, r: 0.32, crater: true },
      { x: -0.35, y: -0.45, z: -0.82, r: 0.45, crater: false },
      { x:  0.55, y:  0.72, z: -0.41, r: 0.38, crater: true },
      { x: -0.85, y: -0.25, z: -0.45, r: 0.35, crater: true },
      { x:  0.15, y:  0.25, z:  0.95, r: 0.30, crater: true },
      { x: -0.15, y:  0.88, z:  0.44, r: 0.36, crater: false },
      { x:  0.78, y: -0.45, z: -0.43, r: 0.34, crater: true },
      { x: -0.55, y:  0.15, z: -0.82, r: 0.42, crater: false },
      { x:  0.32, y: -0.65, z: -0.69, r: 0.38, crater: true },
      { x: -0.42, y: -0.78, z:  0.46, r: 0.32, crater: true }
    ];

    for (let y = 0; y < height; y++) {
      const theta = (y / height) * Math.PI; // 0 a PI
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let x = 0; x < width; x++) {
        const phi = (x / width) * 2 * Math.PI; // 0 a 2*PI

        // Coordenadas 3D unitárias na esfera
        const px = sinTheta * Math.cos(phi);
        const py = cosTheta;
        const pz = sinTheta * Math.sin(phi);

        // Encontrar as 2 distâncias mais próximas (Voronoi F1 e F2)
        let d1 = 999;
        let d2 = 999;
        let closestCell = null;

        for (let i = 0; i < cellCenters.length; i++) {
          const c = cellCenters[i];
          const dist = Math.hypot(px - c.x, py - c.y, pz - c.z);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            closestCell = c;
          } else if (dist < d2) {
            d2 = dist;
          }
        }

        // Borda tectônica entre placas (d2 - d1)
        const cellEdge = d2 - d1;

        // Ruído 3D orgânico em múltiplas frequências
        let noise = 0;
        noise += Math.sin(px * 4.2 + pz * 3.8) * Math.cos(py * 4.5) * 0.35;
        noise += Math.sin(px * 9.5 - py * 8.2) * Math.sin(pz * 9.1) * 0.22;
        noise += Math.cos(px * 19.0 + pz * 18.5) * Math.sin(py * 20.0) * 0.14;
        noise += Math.sin(px * 38.0 - pz * 36.0) * Math.cos(py * 41.0) * 0.08;

        // Composição da elevação
        let elevation = 0.5 + noise;

        // Modulação de cratera se próximo a centro celular de impacto
        if (closestCell && closestCell.crater && d1 < closestCell.r) {
          const ratio = d1 / closestCell.r;
          if (ratio < 0.75) {
            // Depressão central da cratera
            elevation -= 0.32 * (1.0 - ratio / 0.75);
          } else {
            // Anel elevado da borda da cratera
            const rimRatio = (ratio - 0.75) / 0.25;
            elevation += 0.28 * Math.sin(rimRatio * Math.PI);
          }
        }

        // Borda das placas geológicas
        if (cellEdge < 0.25) {
          elevation += (0.25 - cellEdge) * 0.45;
        }

        elevation = Math.max(0, Math.min(1, elevation));

        // Cromatismo: Preto Ônix (#090E17) -> Azul-Marinho Noturno (#131E30) -> Ardósia e Picos (#435670)
        let r, g, b;
        if (elevation < 0.44) {
          const t = elevation / 0.44;
          r = 9 + t * 9;
          g = 14 + t * 15;
          b = 23 + t * 24;
        } else if (elevation < 0.76) {
          const t = (elevation - 0.44) / 0.32;
          r = 18 + t * 34;
          g = 29 + t * 44;
          b = 47 + t * 62;
        } else {
          const t = (elevation - 0.76) / 0.24;
          r = 52 + t * 46;
          g = 73 + t * 50;
          b = 109 + t * 56;
        }

        const idx = (y * width + x) * 4;
        sImg.data[idx]     = Math.floor(r);
        sImg.data[idx + 1] = Math.floor(g);
        sImg.data[idx + 2] = Math.floor(b);
        sImg.data[idx + 3] = 255;

        // Bump map monocromático calibrado
        const bumpVal = Math.floor(elevation * 255);
        bImg.data[idx]     = bumpVal;
        bImg.data[idx + 1] = bumpVal;
        bImg.data[idx + 2] = bumpVal;
        bImg.data[idx + 3] = 255;
      }
    }

    sCtx.putImageData(sImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    const surfaceTexture = new THREE.CanvasTexture(surfCanvas);
    const bumpTexture = new THREE.CanvasTexture(bumpCanvas);

    return { surfaceTexture, bumpTexture };
  }

  // =========================================================================
  // 2. SISTEMA DE EXPANSÃO / ZOOM DOS CARTÕES (FLIP ANIMATION ENGINE)
  // Conexão direta entre o Menu Superior e os Cartões Inferiores
  // =========================================================================
  initZoomExpansionSystem();

  function initZoomExpansionSystem() {
    const navBtnInicio = document.getElementById('nav-btn-inicio');
    const navBtnSobre = document.getElementById('nav-btn-sobre');
    const navBtnProjetos = document.getElementById('nav-btn-projetos');
    const allNavButtons = [navBtnInicio, navBtnSobre, navBtnProjetos];

    const cardSobre = document.getElementById('card-sobre');
    const cardProjetos = document.getElementById('card-projetos');

    const modalSobre = document.getElementById('expanded-sobre');
    const modalProjetos = document.getElementById('expanded-projetos');
    const backdrop = document.getElementById('zoom-backdrop');
    const mainContent = document.getElementById('main-content');

    const closeBtnSobre = document.getElementById('close-modal-sobre');
    const closeBtnProjetos = document.getElementById('close-modal-projetos');
    const returnBtnSobre = document.getElementById('btn-return-sobre');
    const returnBtnProjetos = document.getElementById('btn-return-projetos');

    let currentSection = 'inicio';
    let isTransitioning = false;

    // Listeners do menu superior
    navBtnInicio.addEventListener('click', () => switchSection('inicio'));
    navBtnSobre.addEventListener('click', () => switchSection('sobre-mim'));
    navBtnProjetos.addEventListener('click', () => switchSection('projetos'));

    // Listeners dos cartões compactos
    cardSobre.addEventListener('click', () => switchSection('sobre-mim'));
    cardProjetos.addEventListener('click', () => switchSection('projetos'));

    [cardSobre, cardProjetos].forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const target = card.id === 'card-sobre' ? 'sobre-mim' : 'projetos';
          switchSection(target);
        }
      });
    });

    // Botões de fechar e retorno
    closeBtnSobre.addEventListener('click', () => switchSection('inicio'));
    closeBtnProjetos.addEventListener('click', () => switchSection('inicio'));
    returnBtnSobre.addEventListener('click', () => switchSection('inicio'));
    returnBtnProjetos.addEventListener('click', () => switchSection('inicio'));

    // Fechamento ao clicar no backdrop ou ESC
    backdrop.addEventListener('click', () => switchSection('inicio'));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && currentSection !== 'inicio') {
        switchSection('inicio');
      }
    });

    // Alternador de Seções com animação FLIP de escala/posição
    function switchSection(targetSection) {
      if (isTransitioning || targetSection === currentSection) return;
      isTransitioning = true;

      if (targetSection === 'inicio') {
        if (currentSection === 'sobre-mim') {
          collapseModalToCard(modalSobre, cardSobre, () => finishNavigation('inicio'));
        } else if (currentSection === 'projetos') {
          collapseModalToCard(modalProjetos, cardProjetos, () => finishNavigation('inicio'));
        }
      } else if (targetSection === 'sobre-mim') {
        if (currentSection === 'projetos') {
          crossFadeModals(modalProjetos, cardProjetos, modalSobre, cardSobre, () => finishNavigation('sobre-mim'));
        } else {
          expandCardToModal(cardSobre, modalSobre, () => finishNavigation('sobre-mim'));
        }
      } else if (targetSection === 'projetos') {
        if (currentSection === 'sobre-mim') {
          crossFadeModals(modalSobre, cardSobre, modalProjetos, cardProjetos, () => finishNavigation('projetos'));
        } else {
          expandCardToModal(cardProjetos, modalProjetos, () => finishNavigation('projetos'));
        }
      }
    }

    function finishNavigation(newSection) {
      currentSection = newSection;
      isTransitioning = false;
      updateNavAppearance(newSection);

      // Atualizar hash na URL de forma limpa
      if (history.replaceState) {
        history.replaceState(null, '', newSection === 'inicio' ? '#' : `#${newSection}`);
      }
    }

    function updateNavAppearance(section) {
      allNavButtons.forEach(btn => btn.classList.remove('active'));
      if (section === 'inicio') {
        navBtnInicio.classList.add('active');
      } else if (section === 'sobre-mim') {
        navBtnSobre.classList.add('active');
      } else if (section === 'projetos') {
        navBtnProjetos.classList.add('active');
      }
    }

    // Expansão FLIP do Cartão para Tela Cheia
    function expandCardToModal(sourceCard, targetModal, callback) {
      const originRect = sourceCard.getBoundingClientRect();
      const targetRect = calculateTargetModalRect();

      backdrop.classList.add('is-visible');
      mainContent.classList.add('is-dimmed');

      targetModal.removeAttribute('hidden');
      targetModal.style.transition = 'none';
      targetModal.style.top = `${originRect.top}px`;
      targetModal.style.left = `${originRect.left}px`;
      targetModal.style.width = `${originRect.width}px`;
      targetModal.style.height = `${originRect.height}px`;
      targetModal.style.borderRadius = '24px';
      targetModal.style.opacity = '1';
      targetModal.style.visibility = 'visible';

      sourceCard.style.opacity = '0';
      void targetModal.offsetWidth;

      targetModal.style.transition = prefersReducedMotion
        ? 'opacity 0.2s ease'
        : 'top 0.52s cubic-bezier(0.16, 1, 0.3, 1), left 0.52s cubic-bezier(0.16, 1, 0.3, 1), width 0.52s cubic-bezier(0.16, 1, 0.3, 1), height 0.52s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.52s ease, box-shadow 0.52s ease';

      targetModal.style.top = `${targetRect.top}px`;
      targetModal.style.left = `${targetRect.left}px`;
      targetModal.style.width = `${targetRect.width}px`;
      targetModal.style.height = `${targetRect.height}px`;
      targetModal.style.borderRadius = `${targetRect.borderRadius}px`;

      setTimeout(() => {
        const scrollBody = targetModal.querySelector('.modal-scroll-body');
        if (scrollBody) scrollBody.scrollTop = 0;
        targetModal.focus();
        if (callback) callback();
      }, prefersReducedMotion ? 50 : 530);
    }

    // Colapso FLIP de Tela Cheia de Volta ao Cartão
    function collapseModalToCard(activeModal, sourceCard, callback) {
      const originRect = sourceCard.getBoundingClientRect();

      activeModal.style.transition = prefersReducedMotion
        ? 'opacity 0.2s ease'
        : 'top 0.48s cubic-bezier(0.16, 1, 0.3, 1), left 0.48s cubic-bezier(0.16, 1, 0.3, 1), width 0.48s cubic-bezier(0.16, 1, 0.3, 1), height 0.48s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.48s ease, opacity 0.4s ease';

      activeModal.style.top = `${originRect.top}px`;
      activeModal.style.left = `${originRect.left}px`;
      activeModal.style.width = `${originRect.width}px`;
      activeModal.style.height = `${originRect.height}px`;
      activeModal.style.borderRadius = '24px';

      backdrop.classList.remove('is-visible');
      mainContent.classList.remove('is-dimmed');

      setTimeout(() => {
        activeModal.setAttribute('hidden', '');
        activeModal.style.visibility = 'hidden';
        activeModal.style.opacity = '0';
        sourceCard.style.opacity = '1';
        if (callback) callback();
      }, prefersReducedMotion ? 50 : 490);
    }

    // Transição Suave Cruzada Entre Modais
    function crossFadeModals(closingModal, closingCard, openingModal, openingCard, callback) {
      const targetRect = calculateTargetModalRect();

      closingModal.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
      closingModal.style.opacity = '0';
      closingModal.style.transform = 'scale(0.97)';

      setTimeout(() => {
        closingModal.setAttribute('hidden', '');
        closingModal.style.visibility = 'hidden';
        closingModal.style.transform = '';
        closingCard.style.opacity = '1';

        openingCard.style.opacity = '0';
        openingModal.removeAttribute('hidden');
        openingModal.style.transition = 'none';
        openingModal.style.top = `${targetRect.top}px`;
        openingModal.style.left = `${targetRect.left}px`;
        openingModal.style.width = `${targetRect.width}px`;
        openingModal.style.height = `${targetRect.height}px`;
        openingModal.style.borderRadius = `${targetRect.borderRadius}px`;
        openingModal.style.opacity = '0';
        openingModal.style.transform = 'scale(0.97)';
        openingModal.style.visibility = 'visible';

        void openingModal.offsetWidth;

        openingModal.style.transition = 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        openingModal.style.opacity = '1';
        openingModal.style.transform = 'scale(1)';

        const scrollBody = openingModal.querySelector('.modal-scroll-body');
        if (scrollBody) scrollBody.scrollTop = 0;

        setTimeout(() => {
          if (callback) callback();
        }, 330);
      }, 290);
    }

    // Cálculo Responsivo de Área do Modal
    function calculateTargetModalRect() {
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      if (winWidth <= 640) {
        return {
          top: 66,
          left: 12,
          width: winWidth - 24,
          height: winHeight - 78,
          borderRadius: 20
        };
      } else if (winWidth <= 1024) {
        return {
          top: 76,
          left: 20,
          width: winWidth - 40,
          height: winHeight - 96,
          borderRadius: 24
        };
      } else {
        const maxWidth = 1240;
        const targetWidth = Math.min(winWidth - 48, maxWidth);
        const targetLeft = Math.max(24, (winWidth - targetWidth) / 2);

        return {
          top: 78,
          left: targetLeft,
          width: targetWidth,
          height: winHeight - 98,
          borderRadius: 32
        };
      }
    }

    window.addEventListener('resize', () => {
      if (currentSection === 'sobre-mim') {
        const r = calculateTargetModalRect();
        applyRectStyles(modalSobre, r);
      } else if (currentSection === 'projetos') {
        const r = calculateTargetModalRect();
        applyRectStyles(modalProjetos, r);
      }
    });

    function applyRectStyles(modal, r) {
      modal.style.transition = 'none';
      modal.style.top = `${r.top}px`;
      modal.style.left = `${r.left}px`;
      modal.style.width = `${r.width}px`;
      modal.style.height = `${r.height}px`;
      modal.style.borderRadius = `${r.borderRadius}px`;
    }

    // Suporte a hash inicial na URL (ex: #sobre-mim ou #projetos)
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash === 'sobre-mim' || initialHash === 'projetos') {
      setTimeout(() => switchSection(initialHash), 300);
    }
  }

  // =========================================================================
  // 3. MICROINTERAÇÃO NO CODELAB (SIMULADOR DE CÓDIGO)
  // =========================================================================
  const runBtn = document.querySelector('.mockup-run-btn');
  const termOutput = document.querySelector('.mockup-terminal-output');

  if (runBtn && termOutput) {
    runBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      runBtn.textContent = '⏳ Rodando...';
      termOutput.textContent = '> Processando algoritmos de lógica didática...';

      setTimeout(() => {
        runBtn.textContent = '▶ Executar';
        termOutput.textContent = '> Sucesso! Resultado: { dev: "Lucas Souza", foco: "Evolução Contínua" }';
      }, 650);
    });
  }
});
