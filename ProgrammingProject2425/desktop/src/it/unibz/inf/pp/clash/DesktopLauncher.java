package it.unibz.inf.pp.clash;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3Application;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3ApplicationConfiguration;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.view.DisplayManager;
import it.unibz.inf.pp.clash.view.impl.DisplayManagerImpl;

/**
 * Main class.
 * On macOS, the application needs to be started with the -XstartOnFirstThread JVM argument
 */
public class DesktopLauncher {

    public static void main(String[] arg) {
        Lwjgl3ApplicationConfiguration config = new Lwjgl3ApplicationConfiguration();
        config.setForegroundFPS(60);
        config.setTitle("Clash");
        config.setWindowedMode(1600, 1200);
        DisplayManager displayManager = new DisplayManagerImpl(false);

        EventHandler eventHandler = new GameEventHandler(displayManager);
        // The display manager and the event handler reference each other.
        // So we did not pass the latter to the constructor of the former.
        displayManager.setEventHandler(eventHandler);

        new Lwjgl3Application(
                (ApplicationListener) displayManager,
                config
        );
    }
}
