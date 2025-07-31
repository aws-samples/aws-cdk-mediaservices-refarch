# MediaLive Scheduled Actions Tool

The sendMediaLiveScheduledActions tool simplifies creation of scheduled actions to MediaLive channels. This tool supports the following actions:

1. Input Switch - Switch between different inputs attached to a channel
2. Input Prepare - Prepare an input for a future switch (requires InputPrepareScheduleActions feature to be enabled)
3. SCTE-35 Marker Insertion - Insert SCTE-35 markers for ad breaks
4. Static Image Overlay - Add image overlays to the video (requires OutputStaticImageOverlayScheduleActions feature to be enabled)

The tool automatically checks if the required features are enabled for the selected channel and provides appropriate feedback when a feature is not available. For example, if InputPrepareScheduleActions is not enabled on a channel, the option will still be displayed but marked as unavailable with an explanation.

## Usage

To use the tool:

```bash
# Create Python virtual environment to run scripts (if local Python is not being used)
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt

python3 tools/medialive-scheduled-actions/sendMediaLiveScheduledActions.py
```

Follow the interactive prompts to select a channel and schedule actions. The tool will guide you through the process and provide feedback on available options based on the channel's configuration.

## Important Notes

- **Input Prepare and Static Image Overlay features** must be enabled when creating the MediaLive channel. These features cannot be enabled on a running channel. If you need these features, you must create a new channel with the appropriate feature activations enabled.
- The tool requires appropriate AWS credentials and permissions to access MediaLive channels in your account.