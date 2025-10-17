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
