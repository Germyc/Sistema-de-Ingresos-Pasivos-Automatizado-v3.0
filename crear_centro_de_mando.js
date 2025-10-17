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
