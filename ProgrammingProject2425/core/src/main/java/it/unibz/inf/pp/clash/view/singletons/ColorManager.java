package it.unibz.inf.pp.clash.view.singletons;

import com.badlogic.gdx.graphics.Color;
import java.util.Map;

/**
 * Implements the singleton design pattern.
 */
public class ColorManager {

    public enum GuiColor {
        BACKGROUND,
        BOARD_SEPARATOR,
        BUTTON_BORDER,
        CELL_BACKGROUND,
        CELL_BORDER,
        CELL_INDEX,
        COUNTDOWN,
        EMPTY_CELL,
        ERROR,
        HERO_HEALTH,
        UNIT_BOUNDARY,
        UNIT_COLOR_ONE,
        UNIT_COLOR_TWO,
        UNIT_COLOR_THREE,
        SELECTED_CELL_BACKGROUND,
        REINFORCEMENT
    }

    private static final ColorManager instance = new ColorManager();

    private final Map<GuiColor, Color> colors;

    private ColorManager() {
        colors = FileManager.instance().loadColorPropertyFile();
    }

    public static ColorManager instance() {
        return instance;
    }

    public Color getColor(GuiColor elt) {
        return colors.get(elt);
    }

    static Color convert(String rgbCode) {
        return new Color(
                getPrimaryColor(rgbCode.substring(0, 2)),
                getPrimaryColor(rgbCode.substring(2, 4)),
                getPrimaryColor(rgbCode.substring(4, 6)),
                1.0f
        );
    }

    private static float getPrimaryColor(String hex) {
        return Integer.valueOf(hex, 16) / 255f;
    }

}

