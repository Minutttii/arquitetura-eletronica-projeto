
const int pinoLDR = 34; // Pino analógico onde o sinal do LDR está conectado

void setup() {
  // Inicializa a comunicação serial a 115200 bps (padrão do ESP32)
  Serial.begin(115200);
  
  // Configura o pino como entrada
  pinMode(pinoLDR, INPUT);
  
  Serial.println("--- Teste de LDR Iniciado ---");
}

void loop() {
  // Lê o valor analógico (0 a 4095)
  int valorBruto = analogRead(pinoLDR);
  
  // Converte o valor bruto para uma estimativa de porcentagem (opcional)
  float porcentagem = (valorBruto / 4095.0) * 100.0;
  
  // Exibe os resultados no Serial Monitor
  Serial.print("Leitura ADC: ");
  Serial.print(valorBruto);
  Serial.print(" | Luz aproximada: ");
  Serial.print(porcentagem);
  Serial.println("%");

  // Aguarda 500ms para a próxima leitura (não poluir o monitor)
  delay(500);
}