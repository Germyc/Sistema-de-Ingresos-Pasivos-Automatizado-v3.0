

# **Manual de Implementación: Sistema de Ingresos Pasivos Automatizado v3.0**

**Objetivo:** Construir un flujo automatizado de generación de contenido para Blogger, utilizando la IA integrada de Google Docs (habilitada por una suscripción a Google One Pro) y la automatización de Google Apps Script, sin depender de la facturación de Google Cloud para la IA.

**Arquitectura Final:**

  * **Cerebro:** Google Sheets (`Centro de Mando`).
  * **Motor de Automatización:** Google Apps Script.
  * **Generación de Contenido:** IA integrada en Google Docs (asistida por script).
  * **Plataforma de Publicación:** Blogger.
  * **Infraestructura de Permisos:** Google Cloud Platform (solo para la API de Blogger).

-----

## **Fase 1: Crear la Fundación (El Centro de Mando)**

Primero, crearemos la hoja de cálculo que servirá como nuestro panel de control. Usaremos un script para automatizar su creación y asegurar una configuración perfecta desde el inicio.

#### **Pasos:**

1.  Abre una nueva pestaña del navegador y ve a: **`script.google.com`**

2.  Haz clic en **`+ Nuevo proyecto`**.

3.  **Borra todo** el código de ejemplo y **pega el siguiente script completo**:

    ```javascript
    /**
     * Crea y configura la hoja de cálculo "Centro de Mando de Ingresos Pasivos 3.0".
     * Incluye una fila de ejemplo para guiar al usuario.
     */
    function crearCentroDeMandoV3() {
      try {
        const nombreArchivo = "✅ Centro de Mando de Ingresos Pasivos 3.0";
        const spreadsheet = SpreadsheetApp.create(nombreArchivo);
        Logger.log(`Archivo creado. URL: ${spreadsheet.getUrl()}`);

        const hojaPipeline = spreadsheet.getSheets()[0];
        hojaPipeline.setName("Pipeline_de_Contenido");

        const headers = [
          "content_id", "keyword_principal", "titulo_propuesto",
          "estado_flujo", "url_gdoc_borrador", "url_publicada", "notas_afiliados"
        ];
        
        const headerRange = hojaPipeline.getRange(1, 1, 1, headers.length);
        headerRange.setValues([headers]).setFontWeight("bold").setBackground("#e0e0e0");

        // Añadir una fila de ejemplo
        const ejemplo = [
          "BL-001", "productividad personal", "5 Hábitos para Duplicar tu Productividad Mañana Mismo",
          "1_Pendiente", "", "", "Libro: 'Hábitos Atómicos'"
        ];
        hojaPipeline.getRange(2, 1, 1, ejemplo.length).setValues([ejemplo]);

        const columnaEstado = hojaPipeline.getRange("D2:D");
        const reglaDeValidacion = SpreadsheetApp.newDataValidation()
          .requireValueInList(["1_Pendiente", "2_Borrador_Creado", "3_Listo_Para_Publicar", "4_Publicado", "Error"])
          .setAllowInvalid(false).build();
        columnaEstado.setDataValidation(reglaDeValidacion);

        hojaPipeline.autoResizeColumns(1, headers.length);
        hojaPipeline.setFrozenRows(1);
        
        // Limpieza de hojas extra
        const todasLasHojas = spreadsheet.getSheets();
        if (todasLasHojas.length > 1) {
          for (let i = 1; i < todasLasHojas.length; i++) {
            spreadsheet.deleteSheet(todasLasHojas[i]);
          }
        }
        Logger.log(`Planilla "${nombreArchivo}" creada y configurada con éxito.`);

      } catch (e) {
        Logger.log(`Ha ocurrido un error al crear la planilla: ${e.message}`);
      }
    }
    ```

4.  En la barra de herramientas, asegúrate de que la función seleccionada sea `crearCentroDeMandoV3` y haz clic en **`▶ Ejecutar`**.

5.  **Autoriza los permisos** que te solicite Google.

6.  **Resultado:** Un nuevo archivo llamado **`✅ Centro de Mando de Ingresos Pasivos 3.0`** aparecerá en tu Google Drive.

-----

## **Fase 2: Instalar el Motor de Automatización**

Ahora, instalaremos el script principal que vivirá **dentro** de la planilla que acabamos de crear.

#### **Pasos:**

1.  Abre tu nueva planilla **`✅ Centro de Mando de Ingresos Pasivos 3.0`**.

2.  En el menú, ve a **Extensiones \> Apps Script**. Se abrirá el editor de código.

3.  **Borra todo** el código de ejemplo y **pega el script completo y final** que te proporciono a continuación. Este es nuestro código de producción verificado.

    ```javascript
    // =================================================================================
    // --- CONFIGURACIÓN GLOBAL (SCRIPT V3 FINAL) ---
    // =================================================================================
    const HOJA_PIPELINE = "Pipeline_de_Contenido";
    const ESTADO_PENDIENTE = "1_Pendiente";
    const ESTADO_BORRADOR_CREADO = "2_Borrador_Creado";
    const ESTADO_LISTO_PARA_PUBLICAR = "3_Listo_Para_Publicar";
    const ESTADO_PUBLICADO = "4_Publicado";

    // =================================================================================
    // --- CREACIÓN DE MENÚ PERSONALIZADO ---
    // =================================================================================
    function onOpen() {
      SpreadsheetApp.getUi()
          .createMenu('🤖 Automatización V3')
          .addItem('Crear Borradores', 'crearBorradoresConPromptV3')
          .addToUi();
    }

    // =================================================================================
    // --- MOTOR DE CREACIÓN DE BORRADORES ---
    // =================================================================================
    function crearBorradoresConPromptV3() {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const ui = SpreadsheetApp.getUi();
      const hojaPipeline = spreadsheet.getSheetByName(HOJA_PIPELINE);

      if (!hojaPipeline) {
        ui.alert("Error Crítico", "No se encontró la pestaña 'Pipeline_de_Contenido'.", ui.ButtonSet.OK);
        return;
      }
      
      let idCarpetaDrive = PropertiesService.getUserProperties().getProperty('DRIVE_FOLDER_ID');
      if (!idCarpetaDrive) {
        const response = ui.prompt('Configuración Inicial Requerida', 'Pega el ID de la carpeta de Google Drive donde se guardarán los borradores:', ui.ButtonSet.OK_CANCEL);
        if (response.getSelectedButton() == ui.Button.OK && response.getResponseText() != '') {
          idCarpetaDrive = response.getResponseText();
          PropertiesService.getUserProperties().setProperty('DRIVE_FOLDER_ID', idCarpetaDrive);
        } else { return; }
      }

      try {
        const carpetaBorradores = DriveApp.getFolderById(idCarpetaDrive);
        const datos = hojaPipeline.getDataRange().getValues();
        let borradoresCreados = 0;

        for (let i = 1; i < datos.length; i++) {
          if (datos[i][3] === ESTADO_PENDIENTE) {
            const keywords = datos[i][1];
            const titulo = datos[i][2];
            if (!titulo) continue;
            
            const promptParaDoc = `>> INSTRUCCIÓN PARA GEMINI (Ayúdame a escribir): Actúa como un experto redactor de blogs SEO. Tu única respuesta, sin ningún tipo de introducción o comentario, debe ser el código HTML completo de un artículo de blog.
            
            REGLAS ESTRICTAS:

        1.  Formato: Usa \<h1\> para el título principal, \<h2\> para los subtítulos, \<p\> para párrafos y \<ul\>/\<li\> para listas.
        2.  Contenido: Asegúrate de incluir de forma natural las siguientes palabras clave a lo largo del texto: "${keywords}".
        3.  Footer: Al final del todo, incluye un footer con este texto exacto, reemplazando [AÑO] por el año actual: "\<footer\>\<p\>© [AÑO] Real Dreams. Todos los derechos reservados.\</p\>\<p\>Descargo de responsabilidad: La información proporcionada en este artículo es solo para fines educativos e informativos y no debe considerarse un consejo médico. Consulta siempre a un profesional de la salud.\</p\>\</footer\>".
        4.  Limpieza: NO incluyas las etiquetas \<html\>, \<head\>, o \<body\>. Empieza directamente con \<h1\>.


        ## TEMA DEL ARTÍCULO: Título: "${titulo}<<`;

        const nuevoDoc = DocumentApp.create(titulo);
        nuevoDoc.getBody().setText(promptParaDoc);
        
        const archivoDrive = DriveApp.getFileById(nuevoDoc.getId());
        carpetaBorradores.addFile(archivoDrive);
        try { DriveApp.getRootFolder().removeFile(archivoDrive); } catch (e) { /* Ignorar error de limpieza */ }
        
        hojaPipeline.getRange(i + 1, 4).setValue(ESTADO_BORRADOR_CREADO);
        hojaPipeline.getRange(i + 1, 5).setValue(nuevoDoc.getUrl());
        borradoresCreados++;
       }
     }

     if (borradoresCreados > 0) {
            ui.alert("Proceso Completado", `Se han creado ${borradoresCreados} borrador(es) nuevos.`, ui.ButtonSet.OK);
     } else {
         ui.alert("Nada que Hacer", "No se encontraron filas con estado '1_Pendiente'.", ui.ButtonSet.OK);
        }
    } catch (e) {
          Logger.log(`[ERROR FATAL] Falla al acceder a Drive o en el bucle principal. Error: ${e.toString()}`);
          ui.alert("Error Crítico", `Ha ocurrido un error grave al procesar los borradores. Revisa los registros de ejecución para más detalles. Error: ${e.message}`);
      }
    }
    
    // =================================================================================
    // --- MOTOR DE PUBLICACIÓN (DISPARADOR) ---
    // =================================================================================
    function gestionarEdicion(e) {
      const celdaEditada = e.range;
      const hojaActiva = celdaEditada.getSheet();
      const nuevoValor = celdaEditada.getValue();
      if (hojaActiva.getName() === HOJA_PIPELINE && celdaEditada.getColumn() === 4 && nuevoValor === ESTADO_LISTO_PARA_PUBLICAR) {
        publicarEntradaDirecta(celdaEditada.getRow());
      }
    }
    
    function publicarEntradaDirecta(numeroFila) {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const hojaPipeline = spreadsheet.getSheetByName(HOJA_PIPELINE);
      let blogId = PropertiesService.getUserProperties().getProperty('BLOGGER_ID');
      if (!blogId) {
        const response = SpreadsheetApp.getUi().prompt('Configuración de Blogger', 'Por favor, pega el ID de tu blog de Blogger:', SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);
        if (response.getSelectedButton() == SpreadsheetApp.getUi().Button.OK && response.getResponseText() != '') {
          blogId = response.getResponseText();
          PropertiesService.getUserProperties().setProperty('BLOGGER_ID', blogId);
        } else {
          hojaPipeline.getRange(numeroFila, 4).setValue("Error: ID de Blog cancelado");
          return;
        }
      }
      const datosFila = hojaPipeline.getRange(numeroFila, 1, 1, 7).getValues()[0];
      const titulo = datosFila[2];
      const urlDoc = datosFila[4];
      if (!urlDoc) {
        hojaPipeline.getRange(numeroFila, 4).setValue("Error: URL del Doc vacía");
        return;
      }
      const doc = DocumentApp.openByUrl(urlDoc);
      const contenidoHtml = doc.getBody().getText();
      const apiEndpoint = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`;
      const payload = { "title": titulo, "content": contenidoHtml };
      const options = {
        'method': 'post',
        'contentType': 'application/json',
        'headers': { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
        'payload': JSON.stringify(payload),
        'muteHttpExceptions': true
      };
      try {
        const response = UrlFetchApp.fetch(apiEndpoint, options);
        const jsonResponse = JSON.parse(response.getContentText());
        if (response.getResponseCode() === 200) {
          hojaPipeline.getRange(numeroFila, 4).setValue(ESTADO_PUBLICADO);
          hojaPipeline.getRange(numeroFila, 6).setValue(jsonResponse.url);
        } else {
          hojaPipeline.getRange(numeroFila, 4).setValue("Error de Publicación");
          Logger.log("Error de API de Blogger: " + response.getContentText());
        }
      } catch (error) {
        hojaPipeline.getRange(numeroFila, 4).setValue("Error de conexión");
        Logger.log(error.toString());
      }
    }
    
    // =================================================================================
    // --- FUNCIÓN DE AUTORIZACIÓN MANUAL ---
    // =================================================================================
    /**
     * Ejecuta esta función UNA SOLA VEZ para activar la ventana de permisos.
     * Es normal que falle después de autorizar, su único propósito es activar la ventana.
     */
    function forzarAutorizacionV3() {
      publicarEntradaDirecta(2); // Intenta publicar la fila 2 como prueba para forzar la petición de permisos.
    }

4.  Haz clic en el ícono de **Guardar proyecto** 💾.

-----

## **Fase 3: Configurar la Infraestructura de Permisos**

Este es el paso más técnico, pero lo haremos de forma ordenada para que funcione a la primera.

#### **Pasos:**

1.  **Crear un Proyecto de Cloud Limpio:**
      * Ve a [https://console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate).
      * Nombra el proyecto (ej: `Motor de Contenido V3`) y haz clic en **`CREAR`**.
      * Una vez creado, ve al panel principal y **copia el "Número del proyecto"**.
2.  **Conectar tu Script al Proyecto:**
      * Regresa al **Editor de Apps Script** de tu planilla.
      * Ve a **Configuración del proyecto** (⚙️).
      * Haz clic en **`Cambiar de proyecto`**.
      * **Pega el número del proyecto** que acabas de copiar y haz clic en **`Definir proyecto`**.
3.  **Configurar la Pantalla de Consentimiento:**
      * En la misma pantalla de configuración, te pedirá configurar los **"datos de consentimiento de OAuth"**. Haz clic en el enlace.
      * Elige **Externo** y haz clic en **CREAR**.
      * Rellena los campos obligatorios: Nombre de la app, tu correo de asistencia y tu correo de desarrollador.
      * Haz clic en **GUARDAR Y CONTINUAR** en todas las secciones hasta terminar.
      * **Paso crucial:** Busca la sección **"Usuarios de prueba"**, haz clic en **`+ ADD USERS`** y añáde tu propio correo. Guarda.
      * Finalmente, haz clic en el botón **"PUBLICAR LA APLICACIÓN"** para sacarla del modo de prueba.
4.  **Habilitar la API de Blogger:**
      * Regresa al panel de Google Cloud de tu proyecto.
      * Usa la barra de búsqueda superior para encontrar **`Blogger API`** y haz clic en **HABILITAR**.
5.  **Configurar el Disparador de Publicación:**
      * Regresa al **Editor de Apps Script**.
      * Ve a **Disparadores** (⏰).
      * Haz clic en **`+ Añadir disparador`** y configúralo:
          * Función: **`gestionarEdicion`**
          * Fuente: **`De la hoja de cálculo`**
          * Tipo de evento: **`Al editarse`**
      * Guarda el disparador.

-----

## **Fase 4: Autorización Final y Uso del Sistema**

1.  **Conceder Permisos:**
      * En el **Editor de Apps Script**, selecciona la función **`forzarAutorizacionV3`** en la barra de herramientas.
      * Haz clic en **`▶ Ejecutar`**.
      * **Sigue todos los pasos para conceder los permisos** a tu cuenta (Avanzado ➡️ Ir a...).
2.  **Recargar y Configurar:**
      * **Cierra y vuelve a abrir tu planilla** `Centro de Mando 3.0`. Aparecerá el nuevo menú **`🤖 Automatización V3`**.
      * La primera vez que uses la opción `Crear Borradores`, te pedirá el **ID de la carpeta de Drive**.
      * La primera vez que se active la publicación, te pedirá el **ID de tu blog de Blogger**.
3.  **¡Listo\! El sistema está 100% operativo.**

Ahora puedes seguir el flujo de trabajo final: planificar en la hoja, crear el borrador con el menú, generar el contenido con la IA de Docs y publicarlo cambiando el estado en la planilla.
