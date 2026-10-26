<?xml version="1.0" encoding="UTF-8"?>
<!-- Los valores de "tipo" se copian tal cual del IGN, incluido el error "Transitavilidad". -->
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>red_vial</Name>
    <UserStyle>
      <Title>Red vial por tipo de camino</Title>
      <FeatureTypeStyle>
        <!-- Los caminos de tierra son 93 000 tramos: solo se dibujan de 1:1.500.000 en adelante. -->
        <Rule>
          <Name>tierra</Name>
          <Title>Camino de tierra</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo><ogc:PropertyName>tipo</ogc:PropertyName><ogc:Literal>Camino de Tierra, Camino sin Pavimentar de Transitavilidad Temporaria</ogc:Literal></ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <MaxScaleDenominator>1500000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#BCAAA4</CssParameter>
              <CssParameter name="stroke-width">0.6</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>consolidado</Name>
          <Title>Camino consolidado</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo><ogc:PropertyName>tipo</ogc:PropertyName><ogc:Literal>Camino Consolidado, Camino sin Pavimentar de Transitavilidad Permanente</ogc:Literal></ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <MaxScaleDenominator>5000000</MaxScaleDenominator>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#8D6E63</CssParameter>
              <CssParameter name="stroke-width">1</CssParameter>
              <CssParameter name="stroke-dasharray">4 2</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>pavimentado</Name>
          <Title>Camino pavimentado</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo><ogc:PropertyName>tipo</ogc:PropertyName><ogc:Literal>Camino Pavimentado</ogc:Literal></ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#E67E22</CssParameter>
              <CssParameter name="stroke-width">1.6</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
        <Rule>
          <Name>autopista</Name>
          <Title>Autopista</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo><ogc:PropertyName>tipo</ogc:PropertyName><ogc:Literal>Autopista con Camino Pavimentado Dual con Separador</ogc:Literal></ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#C0392B</CssParameter>
              <CssParameter name="stroke-width">2.8</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
