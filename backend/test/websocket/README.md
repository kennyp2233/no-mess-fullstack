# WebSocket Testing

Este directorio contiene todos los tests relacionados con la funcionalidad WebSocket del sistema.

## Estructura

```
test/websocket/
├── README.md                           # Esta documentación
├── jest-websocket.config.js            # Configuración específica para tests WebSocket
├── setup.ts                            # Configuración del entorno de testing
├── websocket-test.utils.ts             # Utilidades y mocks para testing
├── websocket.gateway.spec.ts           # Tests unitarios del Gateway
├── websocket.service.spec.ts           # Tests unitarios del Service
└── websocket.integration.spec.ts       # Tests de integración
```

## Características de Testing

### 1. Utilidades de Testing

#### WebSocketTestDataFactory
- `createMockUser()` - Crea usuarios mock para testing
- `createMockToken()` - Crea tokens JWT mock
- `createTestMessage()` - Crea mensajes de prueba
- `createVoteData()` - Crea datos de votación
- `createJoinVotingData()` - Crea datos para unirse a salas

#### MockWebSocketClient
- Simula un cliente WebSocket real
- Tracking de eventos emitidos
- Gestión de salas (rooms)
- Métodos de utilidad para assertions

#### WebSocketAssertions
- `expectEvent()` - Verifica que un evento fue emitido
- `expectNoEvent()` - Verifica que un evento NO fue emitido
- `expectEventCount()` - Verifica el número de eventos
- `expectSuccessResponse()` - Verifica respuestas exitosas
- `expectErrorResponse()` - Verifica respuestas de error

#### WebSocketTestUtils
- `createMockSocket()` - Crea sockets mock
- `createMockServer()` - Crea servidor mock
- `waitForEvent()` - Espera por eventos asíncronos
- `waitForMultipleEvents()` - Espera por múltiples eventos

### 2. Tests Unitarios

#### websocket.gateway.spec.ts
- **Connection Management**
  - Conexión exitosa con token válido
  - Conexión sin token
  - Conexión con token inválido
  - Reconexión de usuarios existentes
  - Desconexión de clientes

- **Message Handling**
  - Manejo de mensajes de prueba
  - Validación de datos de entrada
  - Rate limiting
  - Manejo de pong

- **Error Handling**
  - Errores de conexión
  - Errores en mensajes
  - Extracción de tokens
  - Inicialización del gateway

#### websocket.service.spec.ts
- **Connection Management**
  - Agregar/remover conexiones
  - Búsqueda por usuario
  - Verificación de conexión
  - Estadísticas de conexiones

- **Voting Room Management**
  - Unirse/salir de salas
  - Gestión de múltiples salas
  - Estadísticas de salas
  - Broadcasting a salas

- **Health Monitoring**
  - Ping/pong
  - Limpieza de conexiones huérfanas
  - Tracking de salud

- **Messaging**
  - Envío a sockets específicos
  - Envío a usuarios
  - Broadcasting
  - Manejo de errores

### 3. Tests de Integración

#### websocket.integration.spec.ts
- **Voting Flow with Multiple Clients**
  - Flujo completo de votación
  - Múltiples clientes conectados
  - Cast de votos
  - Reconexión de clientes

- **Quorum Detection and Auto-Close**
  - Detección de quórum
  - Auto-cierre de votaciones
  - Timeout sin quórum

- **Notification Delivery**
  - Entrega a todos los participantes
  - Notificaciones personales
  - Manejo de fallos

- **Error Scenarios**
  - Errores de autenticación
  - Rate limiting
  - Limpieza en errores

## Comandos de Testing

### Ejecutar todos los tests WebSocket
```bash
npm run test:websocket
```

### Ejecutar tests en modo watch
```bash
npm run test:websocket:watch
```

### Ejecutar tests con coverage
```bash
npm run test:websocket:cov
```

### Ejecutar tests específicos
```bash
# Tests unitarios del Gateway
npm run test:websocket -- --testNamePattern="AppWebSocketGateway"

# Tests unitarios del Service
npm run test:websocket -- --testNamePattern="WebSocketService"

# Tests de integración
npm run test:websocket -- --testNamePattern="WebSocket Integration Tests"
```

## Cobertura de Tests

Los tests cubren:

### ✅ Funcionalidades Principales
- [x] Connection/disconnection con autenticación
- [x] Join/leave voting rooms
- [x] Cast vote y receive updates
- [x] Error handling scenarios
- [x] Rate limiting
- [x] Heartbeat/ping
- [x] Reconexión automática

### ✅ Flujos de Integración
- [x] Voting flow completo con múltiples clients
- [x] Quórum detection y auto-close
- [x] Notification delivery
- [x] Error scenarios

### ✅ Utilidades de Testing
- [x] Mock WebSocket clients
- [x] Test data factories
- [x] Assertion helpers
- [x] Async event waiting

## Configuración

### jest-websocket.config.js
- Configuración específica para tests WebSocket
- Timeout de 10 segundos
- Coverage reporting
- Setup automático

### setup.ts
- Supresión de logs durante tests
- Mock de timers para consistencia
- Utilidades de testing globales

## Mejores Prácticas

### 1. Organización de Tests
- Tests unitarios separados de tests de integración
- Utilidades reutilizables
- Factories para datos de prueba

### 2. Mocking
- Mock completo del servidor Socket.IO
- Mock de servicios externos
- Mock de timers para tests consistentes

### 3. Assertions
- Assertions específicas para WebSocket
- Verificación de eventos
- Verificación de respuestas estructuradas

### 4. Error Handling
- Tests para todos los escenarios de error
- Verificación de respuestas de error
- Manejo graceful de errores

## Debugging

### Logs de Testing
```bash
# Habilitar logs detallados
npm run test:websocket -- --verbose

# Debug con Node.js
npm run test:websocket -- --inspect-brk
```

### Coverage Report
```bash
# Generar reporte de coverage
npm run test:websocket:cov

# Ver reporte en navegador
open coverage/websocket/index.html
```

## Próximos Pasos

1. **Load Testing** - Tests de carga para WebSocket
2. **Browser Compatibility** - Tests de compatibilidad
3. **Performance Testing** - Tests de rendimiento
4. **Security Testing** - Tests de seguridad
5. **Real-time Testing** - Tests en tiempo real

## Troubleshooting

### Tests Failing
1. Verificar que todos los mocks están configurados
2. Verificar timeouts en tests asíncronos
3. Verificar que los eventos se emiten correctamente

### Coverage Issues
1. Verificar que todos los métodos están cubiertos
2. Verificar que los branches están cubiertos
3. Verificar que los edge cases están cubiertos

### Performance Issues
1. Verificar que los mocks no son pesados
2. Verificar que los timeouts son apropiados
3. Verificar que no hay memory leaks 