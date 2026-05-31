package it.unibz.inf.pp.clash.view.singletons;

import com.badlogic.gdx.scenes.scene2d.ui.Skin;

/**
 * Implements the singleton design pattern
 */
public class SkinManager {

    private static final SkinManager instance = new SkinManager();

    private final Skin defaultSkin;

    private SkinManager(){
        defaultSkin = FileManager.instance().loadDefaultSkin();
    }

    public static SkinManager instance() {
        return instance;
    }

    public Skin getDefaultSkin() {
        return defaultSkin;
    }

    public void dispose(){
        defaultSkin.dispose();
    }

}
