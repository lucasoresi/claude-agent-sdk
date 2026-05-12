# Análisis de la Interfaz de Conversación de IACA

Adjunto el análisis exhaustivo de la interfaz gráfica del chat interactivo "IACA", tal como se visualiza luego de enviar un primer mensaje de prueba ("hola") para recibir una respuesta del asistente. Este documento está estructurado de manera que permita a un desarrollador Front-End (o un agente de IA) replicar el diseño a la perfección (pixel-perfect) usando tecnologías como Next.js, React y TailwindCSS o equivalentes.

---

## 1. Disposición General del Contenedor de Chat (Preview Pane)

*   **Fondo del Contenedor**: Es de un color sólido, gris ultra-claro o casi blanco (`#FAFAFA` o `#FFFFFF`).
*   **Distribución**: El contenedor principal parece aplicar un patrón de flexbox orientado en columna (`flex-col`). 
*   **Área de Mensajes (Historial)**: Absorbe el espacio disponible (`flex-1`, `overflow-y-auto`). Existe una barra de desplazamiento (scrollbar) estilizada a la derecha, con un diseño delgado, rectangular, de color gris sólido y sin esquinas redondeadas dramáticas (similar al estilo por defecto simple).
*   **Ancho Máximo (Max Width)**: El área de visualización de los mensajes parece extenderse a lo ancho, pero los textos de las burbujas no se expanden al 100%.

---

## 2. Burbuja de Mensaje del Usuario

*   **Alineación**: Alineado a la **derecha** de la pantalla (`justify-end` flex container, `self-end`, o `ml-auto`).
*   **Color de Fondo**: Azul brillante, característico de elementos de acción (Primary Color). Un tono aproximado a `#3B82F6` (Azul-500 en Tailwind) o `#2563EB`.
*   **Color de Texto**: Blanco puro (`#FFFFFF`).
*   **Tipografía**: 
    *   **Fuente**: Inter, San Francisco o una fuente sin serifa geométrica limpia.
    *   **Tamaño**: Estándar, aproximadamente `14px` o `15px` (`text-sm` o `text-base`).
    *   **Grosor (Weight)**: Normal (`font-normal` o `400`).
*   **Ancho**: El ancho se adapta al contenido (inline-block o flex inline) (`w-fit`).
*   **Espaciado (Padding)**: Amplio en los laterales y moderado arriba/abajo. Aproximadamente `12px` vertical y `16px` o `20px` horizontal (`px-5 py-2.5` en Tailwind).
*   **Bordes (Border Radius)**: Totalmente redondeado con forma de "píldora" (pill-shape). Un radio de borde de alrededor de `9999px` (`rounded-full`). No hay pico ni indicador de chat direccional (como triangulitos en la esquina de la burbuja).
*   **Sombra**: No posee sombras evidentes (`shadow-none`). Es un diseño "Flat".
*   **Ávatar**: **NO** hay imagen de perfil visible al lado del mensaje del usuario.

---

## 3. Burbuja de Respuesta del Asistente (IACA)

*   **Alineación**: Extremadamente peculiar y destacable: el mensaje del asistente se ubica **centrado horizontalmente** (`justify-center`, `mx-auto`) en la pantalla, en lugar de estar alineado a la izquierda como es habitual en la mayoría de los chats.
*   **Color de Fondo**: Un tono gris muy claro, apenas distinguible del fondo blanco general, aportando un sutil realce (Surface color). Aproximadamente `#F3F4F6` (Gray-100 en Tailwind).
*   **Color de Texto**: Oscuro, posiblemente `#1F2937` (Gray-800) o un casi negro `#111827`, creando alto contraste sobre el fondo gris claro.
*   **Tipografía**: Misma familia sans-serif. El texto `"¡Hola! ¿En qué te puedo ayudar hoy?"` se muestra con tamaño estándar y peso normal (`font-normal`).
*   **Espaciado (Padding)**: Muy similar al del usuario. Unos `px-6 py-3` en Tailwind.
*   **Bordes (Border Radius)**: Al igual que el usuario, también tiene bordes redondeados tipo píldora (`rounded-full` o aproximadamente `24px` a `32px` dependiendo de si se rompe en más líneas).
*   **Interacciones o Íconos Extras**: A diferencia de la barra lateral de V0 (que tiene *Working for Xs*, etc.), en la vista previa central del chatbot **no** se observan actualmente botones de "Copiar", "Regenerar" ni "Me gusta/No me gusta" al lado de la burbuja del primer mensaje del bot en este estado simple. 
*   **Ávatar**: **NO** hay avatar de IA ni logo asociado antes de la burbuja de texto. La burbuja flota sola en el centro.

---

## 4. Campo de Entrada (Input Box)

*   **Ubicación**: Fijo o anclado (Sticky) en la parte inferior del contenedor central (`mt-auto` o `absolute bottom`).
*   **Distancia del fondo**: Tiene un margen inferior que lo separa del límite de la vista (aprox. `16px` o `24px`). También tiene márgenes significativos a sus laterales.
*   **Alineación**: Centrado. Su ancho no abarca toda la pantalla; parece estar limitado por un contenedor con un ancho máximo estricto (ej. `max-w-2xl` o `max-w-3xl`) centrado con `mx-auto`.
*   **Estilo del Contenedor del Input**:
    *   **Color de Fondo**: Casi blanco, igual que el fondo principal o ligeramente traslúcido. 
    *   **Borde**: Tiene un contorno delineado sutil y unicolor muy suave (`border border-gray-200` o `#E5E7EB`). 
    *   **Sombra**: Presenta una sombra increíblemente suave, tal vez un ligero levante con algo equivalente a `shadow-sm`.
    *   **Bordes Reondeados**: Posee un borde un poco más grande que los típicos botones pero no es totalmente circular. Podría ser un `rounded-2xl` o `rounded-3xl` (aprox. `16px - 24px` de radio).
*   **Texto de Marcador de Posición (Placeholder)**: `"Escribe tu mensaje..."` con un color de fuente gris tenue (ej. `text-gray-400`).
*   **Botón de Envío**:
    *   Ubicado a la **derecha** dentro del input.
    *   Es un icono minimalista tipo **"flecha direccional hacia arriba"** (`↑`).
    *   El icono es de líneas delgadas, sin círculo de relleno por detrás ni colores llamativos; su color se presume que sea oscuro/negro (`#000000`) cuando está activo o semi-gris cuando está inactivo.
    *   Es sumamente sencillo y no llama excesivamente la atención ni roba peso ocular.
