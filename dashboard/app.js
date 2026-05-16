/* ================================================================
   LuxControl Dashboard — Application Logic
   Real-time data, simulation mode, MQTT integration, Chart.js
   ================================================================ */

(() => {
  'use strict';

  // ─── CONFIGURATION ──────────────────────────────────────────
  const CONFIG = {
    // MQTT (HiveMQ Cloud — same as station project)
    mqtt: {
      broker: 'wss://377271ae85c448099dc71d8bd61e92c6.s1.eu.hivemq.cloud:8884/mqtt',
      username: 'FabricioTheTuffest',
      password: 'Fabricio67',
      topicData: 'luminosidade/dados',
      topicControl: 'luminosidade/controle',
      clientId: 'luxcontrol-dashboard-' + Math.random().toString(16).slice(2, 8),
    },

    // Simulation
    simulation: {
      enabled: true,        // Start in simulation mode
      forceSimulation: false, // true = NÃO tenta MQTT (só simulação). Mude para false no lab!
      intervalMs: 1500,     // Data generation interval
    },

    // Chart
    chart: {
      maxPoints: 80,        // Max data points on chart
    },

    // Gauge
    gauge: {
      maxLux: 1000,
      arcLength: 251.3,     // SVG arc total length
    },
  };

  // ─── STATE ──────────────────────────────────────────────────
  const state = {
    mode: 'auto',           // 'auto' | 'manual' | 'off'
    setpoint: 300,          // Target lux
    manualDuty: 50,         // Manual duty %
    mqttConnected: false,
    sampleCount: 0,
    startTime: Date.now(),

    // Simulated system state
    sim: {
      lux: 150,
      pwm: 0,
      temp: 24.5,
      humidity: 55,
      ambientLux: 200,      // External ambient light (slowly varies)
      integralError: 0,
      prevError: 0,
    },

    // Stats tracking
    stats: {
      tempMax: null, tempMin: null,
      humidityMax: null, humidityMin: null,
    },

    // Chart data arrays
    chartData: {
      labels: [],
      lux: [],
      setpoint: [],
      pwm: [],
    },
  };

  // ─── DOM REFERENCES ─────────────────────────────────────────
  const dom = {
    // Header
    statusBadge: document.getElementById('connection-status'),
    statusText: document.getElementById('status-text'),
    clock: document.getElementById('clock'),

    // Gauge
    gaugeArc: document.getElementById('gauge-arc'),
    gaugeNeedle: document.getElementById('gauge-needle'),
    luxValue: document.getElementById('lux-value'),
    setpointDisplay: document.getElementById('setpoint-display'),

    // Metrics
    pwmValue: document.getElementById('pwm-value'),
    pwmBar: document.getElementById('pwm-bar'),
    tempValue: document.getElementById('temp-value'),
    tempMax: document.getElementById('temp-max'),
    tempMin: document.getElementById('temp-min'),
    humidityValue: document.getElementById('humidity-value'),
    humidityMax: document.getElementById('humidity-max'),
    humidityMin: document.getElementById('humidity-min'),
    errorValue: document.getElementById('error-value'),
    errorDirection: document.getElementById('error-direction'),

    // Controls
    modeButtons: document.querySelectorAll('.mode-btn'),
    setpointSlider: document.getElementById('setpoint-slider'),
    sliderValue: document.getElementById('slider-value'),
    manualDutyInput: document.getElementById('manual-duty-input'),
    btnSendDuty: document.getElementById('btn-send-duty'),
    presetBtns: document.querySelectorAll('.preset-btn'),

    // Info
    infoSamples: document.getElementById('info-samples'),
    infoUptime: document.getElementById('info-uptime'),
    eventLog: document.getElementById('event-log'),

    // Chart
    chartCanvas: document.getElementById('realtime-chart'),
  };

  // ─── CHART SETUP ────────────────────────────────────────────
  let chart = null;

  function initChart() {
    const ctx = dom.chartCanvas.getContext('2d');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Lux Medido',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#f59e0b',
          },
          {
            label: 'Setpoint',
            data: [],
            borderColor: '#06b6d4',
            borderWidth: 1.5,
            borderDash: [6, 4],
            fill: false,
            tension: 0,
            pointRadius: 0,
          },
          {
            label: 'PWM %',
            data: [],
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.05)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10, 14, 26, 0.9)',
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            titleFont: { family: "'Inter', sans-serif", size: 11 },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          },
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: 'rgba(255,255,255,0.03)',
              drawBorder: false,
            },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              maxTicksLimit: 8,
              maxRotation: 0,
            },
          },
          y: {
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Lux',
              color: '#64748b',
              font: { family: "'Inter', sans-serif", size: 11 },
            },
            grid: {
              color: 'rgba(255,255,255,0.03)',
              drawBorder: false,
            },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
            },
            min: 0,
          },
          y1: {
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'PWM %',
              color: '#64748b',
              font: { family: "'Inter', sans-serif", size: 11 },
            },
            grid: { display: false },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
            },
            min: 0,
            max: 100,
          },
        },
        animation: {
          duration: 400,
          easing: 'easeOutQuart',
        },
      },
    });
  }

  // ─── GAUGE UPDATE ───────────────────────────────────────────
  function updateGauge(lux) {
    const clamped = Math.max(0, Math.min(lux, CONFIG.gauge.maxLux));
    const ratio = clamped / CONFIG.gauge.maxLux;

    // Arc
    const offset = CONFIG.gauge.arcLength * (1 - ratio);
    dom.gaugeArc.style.strokeDashoffset = offset;

    // Needle: -90° (left) to +90° (right)
    const angle = -90 + (ratio * 180);
    dom.gaugeNeedle.style.transform = `rotate(${angle}deg)`;

    // Value text
    dom.luxValue.textContent = Math.round(lux);
  }

  // ─── METRICS UPDATE ─────────────────────────────────────────
  function flashElement(el) {
    el.classList.remove('value-updating');
    void el.offsetWidth; // trigger reflow
    el.classList.add('value-updating');
  }

  function updateMetrics(data) {
    // Lux
    updateGauge(data.lux);

    // PWM
    const pwmPct = Math.round(data.pwm);
    dom.pwmValue.textContent = pwmPct;
    dom.pwmBar.style.width = pwmPct + '%';
    flashElement(dom.pwmValue);

    // Temperature
    dom.tempValue.textContent = data.temp.toFixed(1);
    flashElement(dom.tempValue);
    if (state.stats.tempMax === null || data.temp > state.stats.tempMax) state.stats.tempMax = data.temp;
    if (state.stats.tempMin === null || data.temp < state.stats.tempMin) state.stats.tempMin = data.temp;
    dom.tempMax.textContent = `Máx: ${state.stats.tempMax.toFixed(1)}`;
    dom.tempMin.textContent = `Mín: ${state.stats.tempMin.toFixed(1)}`;

    // Humidity
    dom.humidityValue.textContent = Math.round(data.humidity);
    flashElement(dom.humidityValue);
    if (state.stats.humidityMax === null || data.humidity > state.stats.humidityMax) state.stats.humidityMax = data.humidity;
    if (state.stats.humidityMin === null || data.humidity < state.stats.humidityMin) state.stats.humidityMin = data.humidity;
    dom.humidityMax.textContent = `Máx: ${state.stats.humidityMax}`;
    dom.humidityMin.textContent = `Mín: ${state.stats.humidityMin}`;

    // Error
    const error = data.setpoint - data.lux;
    dom.errorValue.textContent = error.toFixed(1);
    if (Math.abs(error) < 15) {
      dom.errorDirection.textContent = '✓ Dentro do alvo';
      dom.errorDirection.style.color = '#4ade80';
      dom.errorValue.style.color = '#4ade80';
    } else if (error > 0) {
      dom.errorDirection.textContent = '↑ Lux abaixo do setpoint';
      dom.errorDirection.style.color = '#fbbf24';
      dom.errorValue.style.color = '#fbbf24';
    } else {
      dom.errorDirection.textContent = '↓ Lux acima do setpoint';
      dom.errorDirection.style.color = '#22d3ee';
      dom.errorValue.style.color = '#22d3ee';
    }

    // Setpoint display
    dom.setpointDisplay.textContent = data.setpoint + ' lux';

    // Samples
    state.sampleCount++;
    dom.infoSamples.textContent = state.sampleCount;

    // Update chart
    updateChart(data);
  }

  // ─── CHART UPDATE ───────────────────────────────────────────
  function updateChart(data) {
    const now = new Date();
    const label = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(data.lux);
    chart.data.datasets[1].data.push(data.setpoint);
    chart.data.datasets[2].data.push(data.pwm);

    // Trim to max points
    const max = CONFIG.chart.maxPoints;
    if (chart.data.labels.length > max) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(ds => ds.data.shift());
    }

    chart.update('none'); // No animation for smooth real-time feel
  }

  // ─── SIMULATION ENGINE ──────────────────────────────────────
  // Simulates a realistic PID-controlled luminosity system

  function simulateStep() {
    const s = state.sim;
    const dt = CONFIG.simulation.intervalMs / 1000;

    // Slowly drift ambient light (sinusoidal + noise)
    const t = (Date.now() - state.startTime) / 1000;
    s.ambientLux = 180 + 60 * Math.sin(t * 0.05) + 30 * Math.sin(t * 0.13) + (Math.random() - 0.5) * 15;

    // PID parameters (Ziegler-Nichols — do lab)
    const Kp = 3.15;
    const Ki = 18.9;
    const Kd = 0.0;   // Controlador PI (sem derivativo)

    let pwmOutput = 0;

    if (state.mode === 'auto') {
      // PID control (same algorithm as ESP32 firmware)
      const error = state.setpoint - s.lux;
      s.integralError += error * dt;
      // Anti-windup (same as firmware: constrain to ±255/Ki)
      const windupLimit = 255 / Ki;
      s.integralError = Math.max(-windupLimit, Math.min(windupLimit, s.integralError));
      const derivative = (error - s.prevError) / dt;

      // PID output in PWM units (0-255)
      let pwmRaw = Kp * error + Ki * s.integralError + Kd * derivative;
      pwmRaw = Math.max(0, Math.min(255, pwmRaw));
      pwmOutput = (pwmRaw / 255) * 100;  // Convert to % for display
      s.prevError = error;

    } else if (state.mode === 'manual') {
      pwmOutput = state.manualDuty;
      s.integralError = 0;
      s.prevError = 0;

    } else {
      // off
      pwmOutput = 0;
      s.integralError = 0;
      s.prevError = 0;
    }

    s.pwm = pwmOutput;

    // Simulate plant: LED adds lux proportional to PWM, plus ambient
    // First-order system with time constant ~0.3s
    const targetLux = s.ambientLux + pwmOutput * 3;
    const tau = 0.3;
    const alpha = dt / (tau + dt);
    s.lux = s.lux + alpha * (targetLux - s.lux) + (Math.random() - 0.5) * 3;
    s.lux = Math.max(0, s.lux);

    // Temperature: slow random walk around 24-26°C
    s.temp += (Math.random() - 0.5) * 0.15;
    s.temp = Math.max(20, Math.min(32, s.temp));

    // Humidity: slow random walk around 50-65%
    s.humidity += (Math.random() - 0.5) * 0.8;
    s.humidity = Math.max(30, Math.min(80, Math.round(s.humidity)));

    // Send data to UI
    updateMetrics({
      lux: s.lux,
      pwm: s.pwm,
      setpoint: state.setpoint,
      temp: s.temp,
      humidity: s.humidity,
    });
  }

  // ─── MQTT ───────────────────────────────────────────────────
  let mqttClient = null;

  function connectMQTT(simIntervalId) {
    if (typeof mqtt === 'undefined') {
      addLog('MQTT.js não carregado — mantendo simulação', 'warn');
      return;
    }

    try {
      addLog('Conectando ao HiveMQ Cloud...', 'info');

      mqttClient = mqtt.connect(CONFIG.mqtt.broker, {
        username: CONFIG.mqtt.username,
        password: CONFIG.mqtt.password,
        clientId: CONFIG.mqtt.clientId,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      });

      mqttClient.on('connect', () => {
        state.mqttConnected = true;
        CONFIG.simulation.enabled = false;
        // Stop simulation — real data takes over
        if (simIntervalId) clearInterval(simIntervalId);
        setConnectionStatus('connected', 'Conectado');
        addLog('✓ Conectado ao broker MQTT — simulação desligada', 'success');
        mqttClient.subscribe(CONFIG.mqtt.topicData);
      });

      mqttClient.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          updateMetrics({
            lux: data.lux || 0,
            pwm: data.pwm || 0,
            setpoint: data.setpoint || state.setpoint,
            temp: data.temp || 0,
            humidity: data.umid || data.humidity || 0,
          });

          // ── Sync setpoint do ESP32 → slider do dashboard ──
          if (data.setpoint != null && data.setpoint !== state.setpoint) {
            state.setpoint = data.setpoint;
            dom.setpointSlider.value = data.setpoint;
            dom.sliderValue.textContent = data.setpoint + ' lux';
            dom.setpointDisplay.textContent = data.setpoint + ' lux';
          }

          // ── Sync modo do ESP32 → botões do dashboard ──
          if (data.modo && data.modo !== state.mode) {
            setActiveMode(data.modo);
          }
        } catch (e) {
          addLog('Erro ao parsear mensagem MQTT', 'error');
        }
      });

      mqttClient.on('error', (err) => {
        setConnectionStatus('error', 'Erro MQTT');
        addLog('Erro MQTT: ' + err.message, 'error');
      });

      mqttClient.on('close', () => {
        state.mqttConnected = false;
        if (!CONFIG.simulation.enabled) {
          setConnectionStatus('disconnected', 'Desconectado');
          addLog('Conexão MQTT perdida', 'warn');
        }
      });
    } catch (e) {
      addLog('Falha ao criar cliente MQTT: ' + e.message, 'error');
    }
  }

  function publishControl(command, value) {
    const payload = JSON.stringify({ comando: command, valor: value });

    if (mqttClient && state.mqttConnected) {
      mqttClient.publish(CONFIG.mqtt.topicControl, payload);
      addLog(`Enviado: ${command} = ${value}`, 'success');
    } else {
      addLog(`[SIM] Comando: ${command} = ${value}`, 'info');
    }
  }

  // ─── UI HELPERS ─────────────────────────────────────────────
  function setConnectionStatus(type, text) {
    dom.statusBadge.className = 'status-badge ' + type;
    dom.statusText.textContent = text;
  }

  function addLog(message, type = 'info') {
    const entry = document.createElement('div');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${time}] ${message}`;

    dom.eventLog.insertBefore(entry, dom.eventLog.firstChild);

    // Keep max 50 entries
    while (dom.eventLog.children.length > 50) {
      dom.eventLog.removeChild(dom.eventLog.lastChild);
    }
  }

  function setActiveMode(mode) {
    state.mode = mode;
    dom.modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function updateClock() {
    dom.clock.textContent = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Uptime
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    dom.infoUptime.textContent = `${h}:${m}:${s}`;
  }

  // ─── EVENT HANDLERS ─────────────────────────────────────────
  function bindEvents() {
    // Mode buttons
    dom.modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setActiveMode(mode);
        publishControl('modo', mode);
        addLog(`Modo alterado → ${mode.toUpperCase()}`, 'info');
      });
    });

    // Setpoint slider
    dom.setpointSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      state.setpoint = val;
      dom.sliderValue.textContent = val + ' lux';
      dom.setpointDisplay.textContent = val + ' lux';
    });

    dom.setpointSlider.addEventListener('change', (e) => {
      publishControl('setpoint', parseInt(e.target.value));
      addLog(`Setpoint → ${e.target.value} lux`, 'info');
    });

    // Manual duty
    dom.btnSendDuty.addEventListener('click', () => {
      const val = Math.max(0, Math.min(100, parseInt(dom.manualDutyInput.value) || 0));
      state.manualDuty = val;
      dom.manualDutyInput.value = val;
      publishControl('duty', val);
      addLog(`Duty manual → ${val}%`, 'info');
    });

    // Preset buttons
    dom.presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.duty);
        state.manualDuty = val;
        dom.manualDutyInput.value = val;
        publishControl('duty', val);
        addLog(`Preset duty → ${val}%`, 'info');
      });
    });

    // Enter key on duty input
    dom.manualDutyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dom.btnSendDuty.click();
    });
  }

  // ─── INITIALIZATION ─────────────────────────────────────────
  function init() {
    initChart();
    bindEvents();

    // Clock update
    updateClock();
    setInterval(updateClock, 1000);

    // Start simulation immediately (will be stopped if MQTT connects)
    setConnectionStatus('disconnected', 'Simulação');
    addLog('Simulação iniciada', 'warn');
    const simIntervalId = setInterval(simulateStep, CONFIG.simulation.intervalMs);

    // Try MQTT connection (unless forceSimulation is on)
    if (!CONFIG.simulation.forceSimulation) {
      try {
        connectMQTT(simIntervalId);
      } catch (e) {
        addLog('MQTT indisponível — mantendo simulação', 'info');
      }
    } else {
      addLog('forceSimulation = true → MQTT desabilitado', 'info');
      addLog('Mude para false em app.js linha 24 para conectar ao HiveMQ', 'info');
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
