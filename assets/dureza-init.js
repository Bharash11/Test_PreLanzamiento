// dureza-init.js — dzInit(): arranque del módulo, llamado desde app.js una vez cargadas todas las escalas

function dzInit(){
  dzBuildMohs();
  dzMohsTest();
  dzRenderRkTable();
  dzUpdateBrinell();
  dzUpdateMicro();
  dzUpdateConvRange();
  dzInitTsChart();
  dzUpdateTS();
  dzUpdateJanka();
  dzUpdateSclero();
}


