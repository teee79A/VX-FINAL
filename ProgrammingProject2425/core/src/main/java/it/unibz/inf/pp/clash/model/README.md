# Model

This component implements the backed of the application.
This is where (most of) your code should reside.

The model receives inputs from the `controller` component via the `EventHandler` interface.
Your primary objective is to implement this interface.

As outputs, your code should provide instructions to the `view` component, which is in charge of drawing the game on screen.
To do so, you can call the methods exposed via the interface `DisplayManager` of the `view` component.
This interface relies on the notion of a _game snapshot_ (described in the `Snapshot` interface).