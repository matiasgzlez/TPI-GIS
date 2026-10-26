<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>provincias</Name>
    <UserStyle>
      <Title>Provincias</Title>
      <FeatureTypeStyle>
        <Rule>
          <Name>chaco</Name>
          <Title>Provincia del Chaco</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo><ogc:PropertyName>provincia</ogc:PropertyName><ogc:Literal>Chaco</ogc:Literal></ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#FBEFD5</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#8C6D46</CssParameter>
              <CssParameter name="stroke-width">1.6</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
        <Rule>
          <Name>otras</Name>
          <Title>Otras provincias</Title>
          <ElseFilter/>
          <PolygonSymbolizer>
            <Fill><CssParameter name="fill">#F2F0EC</CssParameter></Fill>
            <Stroke>
              <CssParameter name="stroke">#9A9087</CssParameter>
              <CssParameter name="stroke-width">0.8</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
      <FeatureTypeStyle>
        <Rule>
          <Name>etiquetas</Name>
          <TextSymbolizer>
            <Label><ogc:PropertyName>provincia</ogc:PropertyName></Label>
            <Font>
              <CssParameter name="font-family">SansSerif</CssParameter>
              <CssParameter name="font-size">11</CssParameter>
            </Font>
            <LabelPlacement><PointPlacement><AnchorPoint><AnchorPointX>0.5</AnchorPointX><AnchorPointY>0.5</AnchorPointY></AnchorPoint></PointPlacement></LabelPlacement>
            <Halo><Radius>1.5</Radius><Fill><CssParameter name="fill">#FFFFFF</CssParameter></Fill></Halo>
            <Fill><CssParameter name="fill">#5D4E3F</CssParameter></Fill>
            <VendorOption name="autoWrap">80</VendorOption>
          </TextSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
