import React, { Component } from 'react'
import {
  View,
  StyleSheet,
  Text,
  Animated,
} from 'react-native'

import {
  PanGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';


const DefaultColors = {
  valueColor: '#999',
  trackBackgroundColor: '#DDD',
  trackColor: '#666',
  scrubbedColor: 'red',
  bufferedTrackColor: '#999',
}

const ScrubbingRates = {
  half: {
    threshold: 40,
    rate: 0.5
  },
  quarter: {
    threshold: 80,
    rate: 0.25
  },
  fine: {
    threshold: 120,
    rate: 0.1
  }
};

const PLACEHOLDER_DISPLAY_VALUE = '--:--';
const TrackSliderSize = 10;
const SCALE_UP_DURAITON = 150;

formatValue = value => {
  const hours = Math.floor(value / 3600);
  const rawMinutes = (value / 60) - (60 * hours)
  const minutes = Math.floor(rawMinutes)
  const seconds = Math.floor((rawMinutes - minutes) * 60)
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
  const formattedMinutes = minutes < 10 && hours ? `0${minutes}` : minutes;

  if(hours) {
    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
  }
  return `${formattedMinutes}:${formattedSeconds}`
}

export default class extends Component {
  constructor(props) {
    super(props);
    
    this.scaleFactor = new Animated.Value(0);

    this.state = {
      scrubbing: false,
      scrubRate: 1,
      scrubbingValue: 0,
      dimensionWidth: 0,
      startingNumberValue: props.value,
    };


    this._translateX = new Animated.Value(0);
    this._translateY = new Animated.Value(0);

    this._lastOffset = { x: 0, y: 0 };
    this._onGestureEvent = Animated.event(
      [
        {
          nativeEvent: {
            translationX: this._translateX,
            translationY: this._translateY,
          },
        },
      ],
      { useNativeDriver: false }
    );

    this.initiateAnimator();

  }

  static propTypes = {
  }

  componentWillUnmount() {
    this._translateX.removeAllListeners();
  }

  scaleUp = () => {
    Animated.timing(this.scaleFactor, {
        toValue: 1,
        duration: SCALE_UP_DURAITON
    }).start();
  }

  scaleDown = () => {
    Animated.timing(this.scaleFactor, {
        toValue: 0,
        duration: SCALE_UP_DURAITON
    }).start();
  }

  _onHandlerStateChange = event => {

    if (event.nativeEvent.state === State.BEGAN) {      
      const { totalDuration, value } = this.props;
      const currentPercent = totalDuration !== 0 ? Math.min(totalDuration, value) / totalDuration : 0
      const initialX = currentPercent * this.state.dimensionWidth
      const boundedX = Math.min(Math.max(initialX, 0), this.state.dimensionWidth - TrackSliderSize);
      
      this.panResonderMoved = false;

      this._lastOffset.x = boundedX

      this.setState({ scrubbing: true }, this.scaleUp);
    } else if (event.nativeEvent.state === State.ACTIVE) {
      this.panResonderMoved = true;
      this._lastOffset.x += event.nativeEvent.translationX;
      this._lastOffset.y += event.nativeEvent.translationY;
      this._translateX.setOffset(this._lastOffset.x);
      this._translateX.setValue(0);
      this._translateY.setOffset(this._lastOffset.y);
      this._translateY.setValue(0);
    } else if (event.nativeEvent.state === State.END) {
      const { dimensionWidth } = this.state;
      const { totalDuration } = this.props;

      this._lastOffset.x = this._lastOffset.x + this._translateX._value

      const boundedX = Math.min(Math.max(this._lastOffset.x, 0), dimensionWidth);

      const percentScrubbed = boundedX / dimensionWidth;
      const scrubbingValue = percentScrubbed * totalDuration

      if(this.panResonderMoved) {
        this.onSlidingComplete(scrubbingValue)
      }
      
      this.setState({ scrubbing: false, scrubRate: 1 }, this.scaleDown);

    }
  };

  formattedStartingNumber = () => {
    const { scrubbing, startingNumberValue } = this.state;
    const { value, totalDuration } = this.props;

    if(!totalDuration) {
      return PLACEHOLDER_DISPLAY_VALUE
    }

    
    return scrubbing 
      ? formatValue(startingNumberValue)
      : formatValue(value)
  }

  formattedEndingNumber = () => {
    const { value, totalDuration } = this.props;
    const { scrubbing, endingNumberValue } = this.state;
    const cappedValue = Math.min(totalDuration, value)
    const remainingValue = totalDuration - cappedValue

    if(!totalDuration) {
      return PLACEHOLDER_DISPLAY_VALUE
    }
    const scrubbingValue = typeof endingNumberValue === 'number' ? endingNumberValue : remainingValue

    return `-${scrubbing 
      ? formatValue(scrubbingValue)
      : formatValue(remainingValue)}`
  }

  onSlidingComplete = (scrubbingValue) => {
    this.props.onSlidingComplete(scrubbingValue);
  }


  onLayoutContainer = async (e) => {
    await this.setState({
      dimensionWidth: e.nativeEvent.layout.width,
    })
    this.initiateAnimator()
  }

  handleScrubRateChange = value => {
    const { scrubRate } = this.state;
    if(Math.abs(value.y) > ScrubbingRates.fine.threshold) {
      if(scrubRate !== ScrubbingRates.fine.rate) {
        this.setState({ scrubRate: ScrubbingRates.fine.rate })
      }
      return
    }

    if(Math.abs(value.y) > ScrubbingRates.quarter.threshold) {
      if(scrubRate !== ScrubbingRates.quarter.rate) {
        this.setState({ scrubRate: ScrubbingRates.quarter.rate })
      }
      return
    }
    
    if(Math.abs(value.y) > ScrubbingRates.half.threshold) {
      if(scrubRate !== ScrubbingRates.half.rate) {
        this.setState({ scrubRate: ScrubbingRates.half.rate })
      }
      return
    }
    
    if(Math.abs(value.y) < ScrubbingRates.half.threshold) {
      if(scrubRate !== 1) {
        this.setState({ scrubRate: 1 })  
      }
      return
    }
  }

  initiateAnimator = () => {
    this._translateX.addListener(({ value }) => {
      const boundedValue = Math.min(Math.max(value, 0), this.state.dimensionWidth);
      
      this.setState({
        startingNumberValue: (boundedValue / this.state.dimensionWidth) * this.props.totalDuration,
        endingNumberValue: (1 - (boundedValue / this.state.dimensionWidth)) * this.props.totalDuration
      })
      return;
    });
  }

  render() {
    const {
      value = 0,
      bufferedValue = 0,
      totalDuration = 1,
      trackBackgroundColor = DefaultColors.trackBackgroundColor,
      trackColor = DefaultColors.trackColor,
      scrubbedColor = DefaultColors.scrubbedColor,
      bufferedTrackColor = DefaultColors.bufferedTrackColor,
      displayedValueStyle = { color: DefaultColors.valueColor },
    } = this.props;
    
    const {
      scrubbing,
      dimensionWidth,
    } = this.state;
    
    // We don't want any value exceeding the totalDuration
    const cappedValue = Math.min(totalDuration, value)
    const cappedBufferedValue = Math.min(totalDuration, bufferedValue)
    
    const progressPercent = totalDuration !== 0 ? cappedValue / totalDuration : 0;
    const displayPercent = progressPercent * (dimensionWidth);
    const progressWidth = progressPercent * 100
    const bufferedProgressPercent = totalDuration !== 0 ? cappedBufferedValue / totalDuration : 0;
    const bufferedProgressWidth = bufferedProgressPercent * 100
    
    const scrubberColor = 
      scrubbing
        ? { backgroundColor: scrubbedColor }
        : { backgroundColor: trackColor }

    const progressTrackStyle = 
      scrubbing
        ? { backgroundColor: scrubbedColor }
        : { backgroundColor: trackColor }

    const startingValueStyle = 
      scrubbing
        ? [displayedValueStyle, { color: scrubbedColor }]
        : displayedValueStyle
    
    const trackBackgroundStyle = { backgroundColor: trackBackgroundColor }
    const bufferedTrackBackgroundStyle = { backgroundColor: bufferedTrackColor }
  
    let boundX = progressPercent

    if(dimensionWidth) {
      boundX = this._translateX.interpolate({
        inputRange: [0, dimensionWidth],
        outputRange: [0, dimensionWidth],
        extrapolate: 'clamp'
      })
    }

    const scaleValue = this.scaleFactor.interpolate({
      inputRange: [0, 1],
      outputRange: [1.0, 2.0],
    })
    const scaleStyle = { scale: scaleValue };

    
    return (
      <View style={styles.root}>
        <View style={styles.trackContainer} onLayout={this.onLayoutContainer}>
          <View style={[styles.backgroundTrack, trackBackgroundStyle]} />           
          <View 
            key='bufferedTrack'
            style={[
              styles.bufferedProgressTrack,
              { ...bufferedTrackBackgroundStyle },
              { width: `${bufferedProgressWidth}%`}
            ]}
          />
          <Animated.View
            key='backgroundTrack'
            style={[
              styles.progressTrack,
              { ...progressTrackStyle },
              !scrubbing
                ? { width: `${progressWidth}%`}
                : { width: boundX }
            ]}
          />
          <PanGestureHandler
            onGestureEvent={this._onGestureEvent}
            onHandlerStateChange={this._onHandlerStateChange}
            minDist={0}
            hitSlop={{top: 20, bottom: 20, left: 50, right: 50}}
          >
            <Animated.View
              style={[
                styles.trackSliderWrapper,
                !scrubbing
                    ? { left: displayPercent - (TrackSliderSize / 2) }
                    : { transform: [{translateX: boundX}] },
              ]}
              hitSlop={{top: 20, bottom: 20, left: 50, right: 50}}
            >
              <Animated.View 
                key='progressTrack'
                style={[
                  styles.trackSlider,
                  { ...scrubberColor },
                  { transform: [scaleStyle] },
                ]} 
              />
            </Animated.View>
          </PanGestureHandler>
        </View>

        <View style={styles.valuesContainer} >
          <Text style={startingValueStyle}>{this.formattedStartingNumber()}</Text>
          <Text style={displayedValueStyle}>{this.formattedEndingNumber()}</Text>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  valuesContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackContainer: {
    position: 'relative',
    height: 20,
    paddingTop: TrackSliderSize / 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backgroundTrack: {
    position: 'absolute',
    height: 3,
    width: '100%',
    borderRadius: 3,
  },
  progressTrack: {
    position: 'absolute',
    height: 3,
    width: 0,
    left: 0,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    zIndex: 2,
  },
  bufferedProgressTrack: {
    position: 'absolute',
    height: 3,
    width: 0,
    left: 0,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    zIndex: 1,
  },
  trackSliderWrapper: {
    zIndex: 3,
    position: 'absolute',
    left: 0 - (TrackSliderSize / 2),
  },
  trackSlider: {
    width: TrackSliderSize,
    height: TrackSliderSize,
    borderRadius: TrackSliderSize,
    borderColor: '#fff',
  }
});
