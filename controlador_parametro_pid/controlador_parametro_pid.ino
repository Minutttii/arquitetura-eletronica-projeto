#include <DHT.h>

// Definições de Pinos
const int LDR_PIN = 34;       
const int LED_PWM_PIN = 27;   
const int DHT_PIN = 4;        

// Configurações do DHT11
#define DHTTYPE DHT11
DHT dht(DHT_PIN, DHTTYPE);

// Configurações do PWM 
const int freq = 5000;        
const int resolution = 8;     

// Variáveis para temporização
unsigned long tempoAnteriorDHT = 0;
const unsigned long intervaloDHT = 2000; 

// Filtro EMA
float ldrFiltrado = 0;
const float alpha = 0.1; 

// --- PARÂMETROS DO CONTROLADOR SINTONIZADO (ZIEGLER-NICHOLS) ---
double kp = 3.15;  
double ki = 18.9;  
double kd = 0.0;   

double setpointLux = 200.0;

// Memória do Controlador
double erroAcumulado = 0.0;
double erroAnterior = 0.0;
unsigned long tempoAnteriorPID = 0;

void setup() {
  Serial.begin(115200);
  
  dht.begin();
  ledcAttach(LED_PWM_PIN, freq, resolution);
  
  ldrFiltrado = analogRead(LDR_PIN);
  
  Serial.println("Controle Malha Fechada PI - Iniciado!");
}

void loop() {
  unsigned long tempoAtual = millis();

  // --- 1. LEITURA DO SENSOR (A Planta) ---
  int ldrRaw = analogRead(LDR_PIN);
  ldrFiltrado = (alpha * ldrRaw) + ((1.0 - alpha) * ldrFiltrado);
  
  // --- 2. TRATAMENTO DO SINAL (Regressão) ---
  float adcSeguro = constrain(ldrFiltrado, 1.0, 4094.0);
  float rLDR = 10000.0 * (4095.0 / adcSeguro - 1.0);
  float luxReal = 320000.0 * pow(rLDR, -0.90);

  // --- 3. ALGORITMO DO CONTROLADOR PI DISCRETO ---
  double dt = (tempoAtual - tempoAnteriorPID) / 1000.0; 

  if (dt > 0.0) { 
    // Lógica Invertida: Se o LuxReal está baixo, o erro é positivo -> Aumenta PWM
    double erro = setpointLux - luxReal;
    
    double P = kp * erro;
    
    erroAcumulado += erro * dt;
    // Anti-Windup: Trava a memória para não explodir os cálculos
    erroAcumulado = constrain(erroAcumulado, -255.0 / ki, 255.0 / ki); 
    double I = ki * erroAcumulado;
    
    double D = kd * ((erro - erroAnterior) / dt);
    
    double saidaPID = P + I + D;
    
    // --- 4. ATUAÇÃO ---
    int pwmValue = (int)saidaPID;
    pwmValue = constrain(pwmValue, 0, 255);
    ledcWrite(LED_PWM_PIN, pwmValue);
    
    // Atualiza a memória para o próximo loop
    erroAnterior = erro;
    tempoAnteriorPID = tempoAtual;
  }

  // --- 5. EXIBIÇÃO ---
  if (tempoAtual - tempoAnteriorDHT >= intervaloDHT) {
    tempoAnteriorDHT = tempoAtual;
    
    float umidade = dht.readHumidity();
    float temperatura = dht.readTemperature();

    if (isnan(umidade) || isnan(temperatura)) {
      Serial.println("Falha ao ler o sensor DHT11.");
    } else {
      Serial.println("--- Status do Sistema ---");
      Serial.print("Temp: "); Serial.print(temperatura); Serial.print(" °C | ");
      Serial.print("Umid: "); Serial.print(umidade); Serial.println(" %");
      Serial.print("LDR Raw: "); Serial.print(ldrRaw);
      Serial.print(" | Setpoint: "); Serial.print(setpointLux, 1); Serial.println(" Lux");
      Serial.print("Lux Real: "); Serial.print(luxReal, 1);
      Serial.print(" | PWM MOSFET: "); Serial.println((int)constrain(kp*(setpointLux - luxReal) + ki*erroAcumulado, 0, 255));
      Serial.println("-------------------------");
    }
  }
}