# Cuentas por Cobrar

Aplicación web para revisar facturas, generar número de radicado y registrar el pago con recibo de caja.

## Funcionalidades

- Registro de facturas por cobrar
- Revisión del estado de cada factura
- Generación automática de número de radicado
- Radicación para enviar la información a tesorería
- Registro de pago con número de recibo de caja y fecha
- Resumen general por estado

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
npm install
npm start
```

Luego abre en el navegador:

```text
http://localhost:3000
```

## Flujo recomendado

1. Se registra la factura desde la sección de "Registrar factura".
2. El área de revisión cambia el estado a "En revisión" o "Radicada".
3. Al radicar la factura, el sistema genera automáticamente un número del tipo `RAD-YYYYMMDD-####`.
4. La información queda disponible para tesorería.
5. Tesorería registra el número del recibo de caja y la fecha del pago.
6. La factura pasa a "Pago registrado".

## Datos de ejemplo

La app trae datos base para probar el flujo de revisión y tesorería.

## Estructura

- `server.js`: backend con Express y SQLite
- `public/index.html`: interfaz principal
- `public/styles.css`: estilos
- `public/app.js`: lógica del frontend
- `data/receivables.db`: base de datos SQLite al ejecutar la app
