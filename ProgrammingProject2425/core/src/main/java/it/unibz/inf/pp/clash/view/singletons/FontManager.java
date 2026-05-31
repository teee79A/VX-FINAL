package it.unibz.inf.pp.clash.view.singletons;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.freetype.FreeTypeFontGenerator;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Label.LabelStyle;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

/**
 * Implements the singleton design pattern.
 */
public class FontManager {

    public enum FontType {BUTTON, CELL, DEFAULT, INFORMATION}

    private static final FontManager instance = new FontManager();

    private final Map<FontType, String> fontToFileName;

    private FontManager() {
        fontToFileName = FileManager.instance().loadFontPropertyFile();
    }

    public static FontManager instance() {
        return instance;
    }

    /**
     * Maps a font type and a font size to the corresponding LabelStyle.
     * LabelStyles are created in a lazy fashion.
     */
    private final Map<FontType, Map<Integer, LabelStyle>> fontMap = new HashMap<>();

    public Label getLabel(String value, FontType fontType) {
        return getLabel(value, fontType, null);
    }

    public Label getLabel(String value, FontType fontType, Color color) {
        return new Label(
                value,
                getLabelStyle(
                        fontType,
                        Dimensions.instance().getFontSize(fontType),
                        color
                ));
    }

    public void dispose() {
        fontMap.values()
                .forEach(this::dispose);
    }

    private void dispose(Map<Integer, LabelStyle> map) {
        map.values()
                .forEach(l -> l.font.dispose());
    }

    private LabelStyle getLabelStyle(FontType fontType, Integer fontSize, Color color) {
        Map<Integer, LabelStyle> map = fontMap.computeIfAbsent(fontType, k -> new HashMap<>());
        return getLabelStyle(map, fontType, fontSize, color);
    }

    private LabelStyle getLabelStyle(Map<Integer, LabelStyle> fontSizeToLabelStyle, FontType fontType, Integer fontSize,
                                     Color color) {
        LabelStyle labelStyle = fontSizeToLabelStyle.get(fontSize);
        if(labelStyle != null){
            return labelStyle;
        }
        labelStyle = new LabelStyle(
                getBitmapFont(
                        fontType,
                        fontSize
                ),
                color
        );
        fontSizeToLabelStyle.put(fontSize, labelStyle);
        return labelStyle;
    }

    /**
     * If a bitmap font (i.e. a .fnt and a .png file) already exists font this font and size, then loads it.
     * <p>
     * Otherwise, tries to generate a bitmap font from a .ttf file.
     */
    private BitmapFont getBitmapFont(FontType fontType, Integer fontSize) {
        File fntFile = new File("assets/fonts/fnt/" + fontSize + "/" + fontToFileName.get(fontType) + ".fnt");
        if (fntFile.exists()) {
            File pngFile = new File("assets/fonts/png/" + fontSize + "/" + fontToFileName.get(fontType) + ".png");
            if (pngFile.exists()) {
                return new BitmapFont(
                        new FileHandle(fntFile),
                        new FileHandle(pngFile),
                        false
                );
            }
        }
        return generateFont(fontType, fontSize);
    }

    private BitmapFont generateFont(FontType fontType, Integer fontSize) {
        FreeTypeFontGenerator generator = new FreeTypeFontGenerator(getTtfFile(fontType));

        FreeTypeFontGenerator.FreeTypeFontParameter param = new FreeTypeFontGenerator.FreeTypeFontParameter();
        param.size = fontSize;
        param.mono = false;
        BitmapFont font = generator.generateFont(param);
        font.getRegion().getTexture().setFilter(Texture.TextureFilter.Linear, Texture.TextureFilter.Linear);
//        font.getData().setScale(1f);
        return font;
    }

    private FileHandle getTtfFile(FontType fontType) {
        return Gdx.files.internal("fonts/ttf/" + fontToFileName.get(fontType) + ".ttf");
    }
}
