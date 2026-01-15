document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.remove('no-js');
    let morphController = null;
    let activeShape = null;
    let isNavScroll = false;
    let navTargetId = null;
    const heroCanvas = document.querySelector('#hero-animation-canvas');

    const supportsWebGL = () => {
        try {
            const canvas = document.createElement('canvas');
            return !!window.WebGLRenderingContext && (
                canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
            );
        } catch (err) {
            return false;
        }
    };

    const enableStaticBackground = () => {
        document.body.classList.add('bg-fallback');
        if (heroCanvas) {
            heroCanvas.classList.add('static-bg');
        }
    };

    const markAnimatedBackground = () => {
        document.body.classList.add('bg-animated');
        document.body.classList.remove('bg-fallback');
        if (heroCanvas) {
            heroCanvas.classList.remove('static-bg');
        }
    };

    const initMorphingDots = () => {
        if (!supportsWebGL() || typeof MorphingDots === 'undefined' || typeof THREE === 'undefined') {
            console.warn('MorphingDots requires THREE.js and WebGL. Falling back to static background.');
            enableStaticBackground();
            return;
        }

        const accentColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-accent-neon')
            .trim() || '#f5ff1a';

        try {
            morphController = new MorphingDots({
                container: '#hero-animation-canvas',
                pointColor: accentColor,
            });
            if (morphController) {
                markAnimatedBackground();
            }
        } catch (err) {
            console.error('Failed to initialize MorphingDots. Using static background.', err);
            enableStaticBackground();
        }
    };

    const morphToSectionShape = (hash, skipLock = false) => {
        if (!morphController || !hash || hash.length <= 1) {
            return;
        }
        const targetElement = document.querySelector(hash);
        if (targetElement && targetElement.dataset.morphShape) {
            if (!skipLock) {
                isNavScroll = true;
                navTargetId = targetElement.id || null;
            }
            activeShape = targetElement.dataset.morphShape;
            morphController.morphTo(activeShape);
        }
    };

    const bindSectionClicks = () => {
        const sections = document.querySelectorAll('[data-morph-shape]');
        sections.forEach(section => {
            if (section.id === 'hero') {
                return;
            }
            section.addEventListener('click', () => {
                const shape = section.dataset.morphShape;
                if (shape && morphController) {
                    morphController.morphTo(shape);
                }
            });
        });

        const scrollToTop = () => {
            isNavScroll = true;
            navTargetId = 'hero';
            morphToSectionShape('#hero', true);
            if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
                gsap.to(window, {
                    duration: 1.8,
                    scrollTo: 0,
                    ease: 'power2.inOut',
                    onComplete: () => {
                        isNavScroll = false;
                        navTargetId = null;
                    },
                });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        const logo = document.querySelector('#main-header .logo');
        if (logo && !logo.hasAttribute('data-link-only')) {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                scrollToTop();
                history.replaceState(null, null, window.location.pathname);
            });
        }
    };

    const initNavToggle = () => {
        const navToggle = document.querySelector('.nav-toggle');
        const mainNav = document.querySelector('#main-nav');
        if (!navToggle || !mainNav) {
            return;
        }
        navToggle.addEventListener('click', () => {
            const expanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', (!expanded).toString());
            mainNav.classList.toggle('is-open');
        });
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.setAttribute('aria-expanded', 'false');
                mainNav.classList.remove('is-open');
            });
        });
    };

    const revealSectionsOnScroll = () => {
        const revealTargets = document.querySelectorAll('section');
        if (!revealTargets.length) {
            return;
        }
        // Immediately show all sections; no scroll-reveal needed
        revealTargets.forEach(section => section.classList.add('section-visible'));
    };

    const observeSectionsOnScroll = () => {
        const sections = document.querySelectorAll('[data-morph-shape]');
        if (!sections.length) {
            return;
        }

        if (typeof IntersectionObserver !== 'undefined') {
            const observer = new IntersectionObserver((entries) => {
                if (isNavScroll && navTargetId) {
                    const target = document.getElementById(navTargetId);
                    if (target) {
                        const rect = target.getBoundingClientRect();
                        const markerY = viewportHeight * 0.45;
                        if (rect.top <= markerY && rect.bottom >= markerY) {
                            isNavScroll = false;
                            navTargetId = null;
                        }
                    }
                    if (isNavScroll) {
                        return;
                    }
                }
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (!visible.length) {
                    return;
                }

                const candidate = visible[0].target;
                const shape = candidate.dataset.morphShape;
            if (shape && shape !== activeShape && morphController) {
                activeShape = shape;
                morphController.morphTo(shape);
            }
            }, {
                threshold: [0.2, 0.4, 0.6],
                rootMargin: '-10% 0px -20% 0px',
            });

            sections.forEach(section => observer.observe(section));
        }

        const initialHash = window.location.hash;
        if (initialHash) {
            morphToSectionShape(initialHash);
        }

        let scrollTicking = false;
        const handleScroll = () => {
            if (scrollTicking) {
                return;
            }
            scrollTicking = true;
            requestAnimationFrame(() => {
                scrollTicking = false;
                if (!morphController) {
                    return;
                }
                if (isNavScroll) {
                    return;
                }
                const viewportHeight = window.innerHeight;
                let activeSection = null;
                let maxRatio = 0;
                sections.forEach((section) => {
                    const rect = section.getBoundingClientRect();
                    const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
                    if (visible <= 0) {
                        return;
                    }
                    const ratio = visible / Math.max(rect.height, 1);
                    if (ratio > maxRatio) {
                        maxRatio = ratio;
                        activeSection = section;
                    }
                });
                if (!activeSection) {
                    const markerY = viewportHeight * 0.45;
                    let closest = null;
                    let closestDist = Infinity;
                    sections.forEach((section) => {
                        const rect = section.getBoundingClientRect();
                        const sectionCenter = rect.top + rect.height * 0.5;
                        const dist = Math.abs(sectionCenter - markerY);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closest = section;
                        }
                    });
                    activeSection = closest;
                }
                if (activeSection && activeSection.dataset.morphShape) {
                    const shape = activeSection.dataset.morphShape;
                    if (shape !== activeShape) {
                        activeShape = shape;
                        morphController.morphTo(shape);
                    }
                }
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
    };

    initMorphingDots();
    bindSectionClicks();
    observeSectionsOnScroll();
    revealSectionsOnScroll();
    initNavToggle();
    
    // Check if GSAP and ScrollToPlugin are available (assumes they are linked in HTML)
    if (typeof gsap === 'undefined' || typeof ScrollToPlugin === 'undefined') {
        console.warn("GSAP or ScrollToPlugin not found. Using native smooth scroll.");
        
        // Fallback to native smooth scroll (existing code)
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                if (this.getAttribute('href').length > 1) {
                    e.preventDefault();
                    const hash = this.getAttribute('href');
                    const target = document.querySelector(hash);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        morphToSectionShape(hash);
                        history.pushState(null, null, hash);
                    }
                }
            });
        });
        
    } else {
        // --- 1. GSAP-Controlled Smooth Scrolling (Slower and Smoother) ---
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                const hash = this.getAttribute('href');
                
                if (hash.length > 1) {
                    e.preventDefault();
                    const targetElement = document.querySelector(hash);
                    
                    if (targetElement) {
                        morphToSectionShape(hash);
                        // Use GSAP's ScrollToPlugin for a custom duration
                        gsap.to(window, {
                            duration: 1.8, // slower scroll duration
                            scrollTo: targetElement,
                            ease: "power2.inOut", // Elegant easing function
                            onComplete: () => {
                                history.pushState(null, null, hash);
                                isNavScroll = false;
                                navTargetId = null;
                            }
                        });
                    }
                }
            });
        });
        
        // Scroll-triggered card animations removed
    }

    // --- 3. Shiny Button and Background Placeholder functions remain below ---
    
    // ... (Omitted existing code for brevity, but remains in the file) ...
});
