package it.unibz.inf.pp.clash.view.singletons;

import java.util.HashMap;
import java.util.Map;

import static it.unibz.inf.pp.clash.view.singletons.FontManager.FontType;
import static it.unibz.inf.pp.clash.view.singletons.FontManager.FontType.*;

/**
 * Implements the singleton design pattern.
 */
public class Dimensions {


    public enum Resolution {R_1920x1080("1920x1080"), R_1366x768("1366x768");

        public final String asString;

        Resolution(String asString) {
            this.asString = asString;
        }
    }

    private static final Dimensions instance = new Dimensions();

    private final Resolution defaultResolution = Resolution.R_1920x1080;


    private Resolution activeResolution;
    private Map<FontManager.FontType, Integer> fontSize;
    private int smallSpace;
    private int mediumSpace;
    private int largeSpace;
    private int UnitBoundaryThickness;
    private int tileBorderThickness;
    private int smallSquareIconLength;
    private int mediumSquareIconLength;
    private int largeSquareIconLength;
    private int squarePortraitLength;
    private int playerSeparatorHeight;
    private int infoboxWidth;
    private int tileWidth;

    private Dimensions() {
        update(FileManager.instance().parseResolution(defaultResolution));
    }

    public static Dimensions instance() {
        return instance;
    }

    public Resolution getActiveResolution() {
        return activeResolution;
    }

    public void update(Resolution resolution){

        tileBorderThickness = 1;
        fontSize = new HashMap<>();

        switch (resolution){
            case R_1920x1080 -> {
                activeResolution = resolution;

                UnitBoundaryThickness = 4;
                playerSeparatorHeight = 5;

                smallSquareIconLength = 19;
                mediumSquareIconLength = 32;
                largeSquareIconLength = 64;

                squarePortraitLength = 160;

                infoboxWidth = 300;
                tileWidth = 80;

                fontSize = new HashMap<>();
                fontSize.put(CELL, 19);
                fontSize.put(INFORMATION, 22);
                fontSize.put(DEFAULT, 30);

                smallSpace = 8;
                mediumSpace = 16;
                largeSpace = 30;
            }
            case R_1366x768 -> {
                activeResolution = resolution;

                UnitBoundaryThickness = 3;
                playerSeparatorHeight = 4;

                smallSquareIconLength = 13;
                mediumSquareIconLength = 20;
                largeSquareIconLength = 44;

                squarePortraitLength = 112;

                infoboxWidth = 220;
                tileWidth = 55;

                fontSize.put(CELL, 13);
                fontSize.put(INFORMATION, 19);
                fontSize.put(DEFAULT, 22);

                smallSpace = 6;
                mediumSpace = 12;
                largeSpace = 22;
            }
        }
        activeResolution = resolution;
    }

    public int getFontSize(FontType fontType) {
        return fontSize.get(fontType);
    }

    public int getUnitBoundaryThickness() {
        return UnitBoundaryThickness;
    }

    public int getSmallSquareIconLength() {
        return smallSquareIconLength;
    }

    public int getMediumSquareIconLength() {
        return mediumSquareIconLength;
    }

    public int getLargeSquareIconLength() {
        return largeSquareIconLength;
    }

    public int getPlayerSeparatorHeight() {
        return playerSeparatorHeight;
    }

    public int getSquarePortraitLength() {
        return squarePortraitLength;
    }

    public int getTileBorderThickness() {
        return tileBorderThickness;
    }

    public float getInfoboxWidth() {
        return infoboxWidth;
    }

    public int getSmallSpace() {
        return smallSpace;
    }

    public int getMediumSpace() {
        return mediumSpace;
    }

    public int getLargeSpace() {
        return largeSpace;
    }
    public int getTileWidth() {
        return tileWidth;
    }


}
