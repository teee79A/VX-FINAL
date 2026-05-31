package it.unibz.inf.pp.clash.view.singletons;

import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static it.unibz.inf.pp.clash.view.singletons.Dimensions.Resolution;

/**
 * Implements the singleton design pattern.
 */
public class FileManager {

    private static final FileManager instance = new FileManager();

    private final String generalConfigFile = "config.properties";
    private final String imageFolder = "images/";
    private final String iconsConfigFile = imageFolder + "icons.properties";
    private final String mobileUnitsConfigFile = imageFolder + "mobileUnits.properties";
    private final String staticUnitsConfigFile = imageFolder + "staticUnits.properties";
    private final String portraitsConfigFile = imageFolder + "portraits.properties";
    private final String colorsConfigFile = "colors/colors.properties";
    private final String fontConfigFile = "fonts/fonts.properties";
    private final String skinFile = "skins/default/skin/uiskin.json";
    private final String llmTutorial = "prompts/llmtutorial.txt";

    private FileManager() {
    }

    public static FileManager instance() {
        return instance;
    }

    public String loadLLMTutorialPrompt() {
        try (FileInputStream fis = new FileInputStream(llmTutorial)) {
            byte[] data = fis.readAllBytes();
            return new String(data, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    Map<String, String> loadPortraitPropertyFile() {
        return loadPropertyFile(portraitsConfigFile)
                .collect(Collectors.toMap(
                        e -> e.getKey().toString(),
                        e -> e.getValue().toString()
                ));
    }

    Map<FontManager.FontType, String> loadFontPropertyFile() {
        return loadPropertyFile(fontConfigFile)
                .collect(Collectors.toMap(
                        e -> FontManager.FontType.valueOf(e.getKey().toString().toUpperCase()),
                        e -> e.getValue().toString()
                ));
    }

    Map<ImageManager.Icon, String> loadIconPropertyFile() {
        return loadPropertyFile(iconsConfigFile)
                .collect(Collectors.toMap(
                        e -> ImageManager.Icon.valueOf(e.getKey().toString().toUpperCase()),
                        e -> e.getValue().toString()
                ));
    }

    Map<Class, String> loadMobileUnitPropertyFile() {
        return loadUnitsPropertyFile(mobileUnitsConfigFile);
    }

    Map<Class, String> loadStaticUnitPropertyFile() {
        return loadUnitsPropertyFile(staticUnitsConfigFile);
    }


    Map<ColorManager.GuiColor, Color> loadColorPropertyFile() {
        Properties hexColorCodes = new Properties();
        try {
            hexColorCodes.load(new FileInputStream(colorsConfigFile));
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        return hexColorCodes.entrySet().stream()
                .collect(Collectors.toMap(
                        e -> ColorManager.GuiColor.valueOf(e.getKey().toString().toUpperCase()),
                        e -> ColorManager.convert(e.getValue().toString())
                ));
    }

    public void updateResolution(Resolution resolution) {
        Properties properties = new Properties();
        try {
            properties.load(new FileInputStream(generalConfigFile));
            properties.setProperty("resolution", resolution.asString);
            properties.store(new FileOutputStream(generalConfigFile), null);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private Map<Class, String> loadUnitsPropertyFile(String path) {
        return loadPropertyFile(path)
                .collect(Collectors.toMap(
                        e -> getClassNameFromString(e.getKey().toString()),
                        e -> e.getValue().toString()
                ));
    }

    public String[] getHeroNames() {
        return loadPropertyFile(portraitsConfigFile)
                .map(Map.Entry::getKey)
                .map(s -> (String) s)
                .sorted()
                .toArray(String[]::new);
    }

    public Resolution parseResolution(Resolution defaultResolution) {
        Resolution resolution;
        Properties properties = new Properties();
        try {
            properties.load(new FileInputStream(generalConfigFile));
            resolution = Resolution.valueOf("R_" + properties.getProperty("resolution").toLowerCase());
        } catch (IOException | IllegalArgumentException e) {
            return defaultResolution;
        }
        return resolution;
    }

    public float parseAnimationDuration(float defaultDuration) {
        float duration;
        Properties properties = new Properties();
        try {
            properties.load(new FileInputStream(generalConfigFile));
            duration = Float.parseFloat(properties.getProperty("animationDuration"));
        } catch (IOException | IllegalArgumentException | NullPointerException e) {
            return defaultDuration;
        }
        return duration;
    }

    private static Class getClassNameFromString(String string) {
        try {
            return Class.forName(string);
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }

    private Stream<Map.Entry<Object, Object>> loadPropertyFile(String path) {
        Properties properties = new Properties();
        try {
            properties.load(new FileInputStream(path));
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        return properties.entrySet().stream();
    }

    public Skin loadDefaultSkin() {
        return new Skin(new FileHandle(skinFile));
    }
}
