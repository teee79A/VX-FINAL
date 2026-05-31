package it.unibz.inf.pp.clash.view.screen;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.utils.ScreenUtils;
import com.badlogic.gdx.utils.viewport.ScreenViewport;
import it.unibz.inf.pp.clash.view.singletons.ColorManager;

public abstract class AbstractScreen implements Screen {

    protected final Stage stage;

    protected final boolean debug;

    public AbstractScreen(boolean debug) {
        this.debug = debug;
        stage = new Stage(new ScreenViewport());
        Gdx.input.setInputProcessor(stage);
    }

    @Override
    public void show() {
        Gdx.input.setInputProcessor(stage);
    }

    @Override
    public void render(float delta) {
        clearScreen();
        stage.act();
        stage.draw();
    }

    @Override
    public void resize(int width, int height) {
        stage.getViewport().update(width, height, true);
    }

    @Override
    public void pause() {

    }

    @Override
    public void resume() {
    }

    @Override
    public void hide() {

    }
    @Override
    public void dispose() {
        stage.dispose();
    }

    void clearScreen() {
        ScreenUtils.clear(ColorManager.instance().getColor(ColorManager.GuiColor.BACKGROUND));
    }

    /**
     * Disables automatic calls (30 to 80 times per second) to the method {@link Screen#render(float)} , for performance.
     * It will only be called if an event (mouse hovering, click, etc.) is triggered.
     */
    protected void disableContinuousRendering() {
        Gdx.graphics.setContinuousRendering(false);
    }

    /**
     * Enables automatic calls (30 to 80 times per second) to the method {@link Screen#render(float)} for performance.
     * It will only be called if an event (mouse hovering, click, etc.) is triggered.
     */
    protected void enableContinuousRendering() {
        Gdx.graphics.setContinuousRendering(true);
    }

}
