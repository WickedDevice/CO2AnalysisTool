angular.module('MyApp', ['ngFileUpload'])
.controller('UploadCtrl', ['$scope', 'Upload', '$timeout', function ($scope, Upload, $timeout) {

    $scope.csvdata = [];
    $scope.zoom_start_date = null;
    $scope.zoom_end_date = null;
    $scope.csv_header_row = [];
    $scope.csv_header_row_reduced = [];
    $scope.trace1_field = null;
    $scope.trace2_field = null;
    $scope.primary_column = null;
    $scope.secondary_column = null;
    $scope.primary_columns = [];
    $scope.secondary_columns = [];
    $scope.primary_axis_title = null;
    $scope.secondary_axis_title = null;
    $scope.target_devices = [{idx: -1, name: 'None'}];
    $scope.target_device = -1;

    $scope.regressions = []; // will ultimately contain an object encapsulating regression results for each egg
    $scope.summary_stats = null;;

    $scope.at_least_one_regression = function(){
      return $scope.regressions.length > 0;
    };

    $scope.header_loaded = function(){
        return $scope.csv_header_row.length > 0;
    };

    $scope.asPercent = function(value){
      return Math.round(value * 100) + "%";
    };

    $scope.addToPlotPrimary = function(){
      // add all the columns that look "like" csv_header_row_reduced[primary_column]
      if($scope.primary_column === null){
        return;
      }

      $scope.regressions = [];

      $scope.primary_axis_title = $scope.csv_header_row_reduced[$scope.primary_column].name;

      $scope.primary_columns = [];
      for(var ii = 0; ii < $scope.csv_header_row.length; ii++){
        if($scope.csv_header_row[ii].name.indexOf($scope.primary_axis_title) >= 0){
          $scope.primary_columns.push(ii);
        }
      }

      renderPlots();
    };

    $scope.removeFromPlotPrimary = function(){
      $scope.regressions = [];
      $scope.primary_columns = [];
      $scope.primary_axis_title = null;
      renderPlots();
    };

    $scope.addToPlotSecondary = function(){
      // add all the columns that look "like" csv_header_row_reduced[seconday_column]
      if($scope.secondary_column === null){
        return;
      }

      $scope.secondary_axis_title = $scope.csv_header_row_reduced[$scope.secondary_column].name;

      $scope.secondary_columns = [];
      for(var ii = 0; ii < $scope.csv_header_row.length; ii++){
        if($scope.csv_header_row[ii].name.indexOf($scope.secondary_axis_title) >= 0){
          $scope.secondary_columns.push(ii);
        }
      }

      renderPlots();
    };

    $scope.removeFromPlotSecondary = function(){
      $scope.secondary_columns = [];
      $scope.secondary_axis_title = null;
      renderPlots();
    };

    $scope.primary_column_change = function() {
      $scope.trace1_field = $scope.primary_column
    }

    $scope.secondary_column_change = function() {
      $scope.trace2_field = $scope.secondary_column
    }

    $scope.target_device_change = function(){
      renderPlots();
    }

    $scope.uploadFiles = function (files) {
        $scope.files = files;
        if (files && files.length) {
            $scope.generated_filename = null;
            Upload.upload({
                url: 'upload',
                method: 'POST',
                data: {
                    files: files
                }
            }).then(function (response) { // file is uploaded successfully
                $timeout(function () {
                    $scope.result = response.data;
                    $scope.progress = -1; // clear the progress bar
                    $scope.target_devices = [{idx: -1, name: 'None'}];
                    $scope.target_device = -1;
                    $scope.regressions = [];
                    $scope.summary_stats = null;

                    $scope.csv_header_row = response.data.data[0].map(function(value, index){
                       return {
                           idx: index,
                           name: value
                       };
                    });

                    $scope.target_devices = {};
                    for(var ii = 0; ii < $scope.csv_header_row.length; ii++){
                      var tmp = $scope.csv_header_row[ii].name.split("-");
                      if(tmp.length > 1){
                        tmp = tmp[0].split(".");
                        if(tmp.length > 1){
                          $scope.target_devices[tmp[0]] = 1;
                        }
                      }
                    }
                    $scope.target_devices = Object.keys($scope.target_devices).map(function(value, index){
                      return {
                        idx: index,
                        name: value
                      };
                    });
                    $scope.target_devices = [{idx: -1, name: 'None'}].concat($scope.target_devices);


                    // hyphen is a delimiter, what we really want is a list of the unique
                    // things that are to the right of hypens in the values above
                    $scope.csv_header_row_reduced = {};
                    for(var ii = 0; ii < $scope.csv_header_row.length; ii++){
                      var name = $scope.csv_header_row[ii].name;
                      var rhs = name.split('-');
                      if(rhs.length > 1){
                        $scope.csv_header_row_reduced[rhs[1]] = 1;
                      }
                    }
                    // rewind the keys back into an array
                    $scope.csv_header_row_reduced = Object.keys($scope.csv_header_row_reduced).map(function(value, index){
                      return {
                        idx: index,
                        name: value
                      };
                    });


                    $scope.generated_filename = response.data.filename.split(".")[0];
                    $scope.csvdata = response.data.data;
                    for(var ii = 1; ii < $scope.csvdata.length; ii++){
                        var m = moment($scope.csvdata[ii][0], "YYYY-MM-DD HH:mm:ss");
                        $scope.csvdata[ii][0] = {
                            str: $scope.csvdata[ii][0],
                            moment: m
                        };

                        for(var jj = 1; jj < $scope.csvdata[ii].length; jj++){
                            var val = null;
                            try{
                                val = parseFloat($scope.csvdata[ii][jj])
                                if(!isNaN(val)) {
                                    $scope.csvdata[ii][jj] = val;
                                }
                                else{
                                    $scope.csvdata[ii][jj] = null;
                                }
                            }
                            catch(e){
                                $scope.csvdata[ii][jj] = null;
                            }
                        }
                    }

                    renderPlots();
                });
            }, function (response) {      // handle error
                if (response.status > 0) {
                    $scope.errorMsg = response.status + ': ' + response.data;
                    $scope.progress = -1; // clear the progress bar
                }
            }, function (evt) {          // progress notify
                $scope.progress =
                    Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
            });
        }
    };

    function renderPlots(){

        var data = [];
        if($scope.primary_columns) {
          for (var ii = 0; ii < $scope.primary_columns.length; ii++) {
            var column = $scope.primary_columns[ii];
            var trace = {
              x: $scope.csvdata.map(function (currentValue, index) {
                return currentValue[0].str; // always plot against time
              }).slice(1),
              y: $scope.csvdata.map(function (currentValue, index) {
                return parseFloat(currentValue[column]);
              }).slice(1),
              mode: 'lines+markers',
              yaxis: 'y',
              type: 'scatter',
              name: $scope.csv_header_row[column].name.split("-")[0].split(".")[0]
            };
            data.push(trace);
          }
        }

        if($scope.secondary_columns) {
          for (var ii = 0; ii < $scope.secondary_columns.length; ii++) {
            var column = $scope.secondary_columns[ii];
            var trace = {
              x: $scope.csvdata.map(function(currentValue, index){
                return currentValue[0].str; // always plot against time
              }).slice(1),
              y: $scope.csvdata.map(function(currentValue, index){
                return parseFloat(currentValue[column]);
              }).slice(1),
              mode: 'lines+markers',
              yaxis: 'y2',
              type: 'scatter',
              name: $scope.csv_header_row[column].name.split("-")[0].split(".")[0]
            };
            data.push(trace);
          }
        }

        var layout = {height: 600};

        if($scope.primary_axis_title){
          layout.yaxis = {title: $scope.primary_axis_title};
          layout.title = $scope.primary_axis_title;
        }

        if($scope.secondary_axis_title) {
          layout.yaxis2 = {
            title: $scope.secondary_axis_title,
            overlaying: 'y',
            side: 'right'
          };

          if(layout.title){
            layout.title += " and ";
          }

          layout.title += $scope.secondary_axis_title;
        }

        if(layout.title){
          layout.title += " vs. Time";
        }

        Plotly.newPlot('scatterplot', data, layout);

        $scope.zoom_start_date = $scope.csvdata[1][0].moment;
        $scope.zoom_end_date = $scope.csvdata[$scope.csvdata.length - 1][0].moment;

        $('#'+"scatterplot").bind('plotly_relayout',function(event, eventdata){
            if(eventdata["xaxis.autorange"]){
                $scope.zoom_start_date = $scope.csvdata[1][0].moment;
                $scope.zoom_end_date = $scope.csvdata[$scope.csvdata.length - 1][0].moment;

            }
            else if(eventdata["xaxis.range[0]"] && eventdata["xaxis.range[1]"]){
                $scope.zoom_start_date = moment(eventdata["xaxis.range[0]"]);
                $scope.zoom_end_date = moment(eventdata["xaxis.range[1]"]);

            }

            updateLogLinear();
            $scope.$apply();
        });

        updateLogLinear();
    }

    function updateLogLinear(){
      var logdata = [];
      var primary_x_data = [];
      var primary_x_moments = [];
      var primary_y_data = [];
      var secondary_x_data = [];
      var secondary_x_moments = [];
      var secondary_y_data = [];

      if($scope.primary_columns) {
        for (var ii = 0; ii < $scope.primary_columns.length; ii++) {
          var column = $scope.primary_columns[ii];
          var device_name = $scope.csv_header_row[column].name.split('-')[0].split(".")[0];

          primary_x_data[ii] = {
            device: device_name,
            data: $scope.csvdata.slice(1).filter(function (value) {
              var m = value[0].moment;
              return m.isSameOrAfter($scope.zoom_start_date) && m.isSameOrBefore($scope.zoom_end_date);
            }).map(function (currentValue, index) {
              return currentValue[0].str; // always plot against time
            })
          };

          primary_x_moments[ii] = {
            device: device_name,
            data: $scope.csvdata.slice(1).filter(function (value) {
              var m = value[0].moment;
              return m.isSameOrAfter($scope.zoom_start_date) && m.isSameOrBefore($scope.zoom_end_date);
            }).map(function (currentValue, index) {
              return currentValue[0].moment; // always plot against time
            })
          };

          primary_y_data[ii] = {
            device: device_name,
            data: $scope.csvdata.slice(1).filter(function(value){
              var m = value[0].moment;
              return m.isSameOrAfter($scope.zoom_start_date) && m.isSameOrBefore($scope.zoom_end_date);
            }).map(function (currentValue, index) {
              return Math.log(parseFloat(currentValue[column]));
            })
          };

          var logtrace = {
            x: primary_x_data[ii].data,
            y: primary_y_data[ii].data,
            mode: 'lines+markers',
            yaxis: 'y',
            type: 'scatter',
            name: device_name
          };
          logdata.push(logtrace);
        }
      }

      if($scope.secondary_columns) {
        for (var ii = 0; ii < $scope.secondary_columns.length; ii++) {
          var column = $scope.secondary_columns[ii];
          var device_name = $scope.csv_header_row[column].name.split("-")[0].split(".")[0];

          secondary_x_data[ii] = {
            device: device_name,
            data: $scope.csvdata.slice(1).filter(function(value){
              var m = value[0].moment;
              return m.isSameOrAfter($scope.zoom_start_date) && m.isSameOrBefore($scope.zoom_end_date);
            }).map(function (currentValue, index) {
              return currentValue[0].str; // always plot against time
            })
          };

          secondary_x_moments[ii] = {
            device: device_name,
            data: $scope.csvdata.slice(1).filter(function(value){
              var m = value[0].moment;
              return m.isSameOrAfter($scope.zoom_start_date) && m.isSameOrBefore($scope.zoom_end_date);
            }).map(function (currentValue, index) {
              return currentValue[0].moment; // always plot against time
            })
          };

          secondary_y_data[ii] = {
            device: device_name,
            data: $scope.csvdata.slice(1).filter(function(value){
              var m = value[0].moment;
              return m.isSameOrAfter($scope.zoom_start_date) && m.isSameOrBefore($scope.zoom_end_date);
            }).map(function (currentValue, index) {
              return Math.log(parseFloat(currentValue[column]));
            })
          };

          var logtrace = {
            x: secondary_x_data[ii].data,
            y: secondary_y_data[ii].data,
            mode: 'lines+markers',
            yaxis: 'y',
            type: 'scatter',
            name: device_name
          };
          logdata.push(logtrace);
        }
      }

      var loglayout = {height: 600};

      if($scope.primary_axis_title){
        loglayout.yaxis = {title: "LOG("+$scope.primary_axis_title+")"};
        loglayout.title = "LOG("+$scope.primary_axis_title+")";
      }

      if($scope.secondary_axis_title) {
        loglayout.yaxis2 = {
          title: "LOG("+$scope.secondary_axis_title+")",
          overlaying: 'y',
          side: 'right'
        };

        if(loglayout.title){
          loglayout.title += " and ";
        }

        loglayout.title += "LOG("+$scope.secondary_axis_title + ")";
      }

      if(loglayout.title){
        loglayout.title += " vs. Time";
      }

      // find the target device name
      var target_name = null;
      for(var ii = 0; ii < $scope.target_devices.length; ii++){
        var device = $scope.target_devices[ii];
        if(device.idx == $scope.target_device){
          target_name = device.name;
        }
      }

      if(target_name !== null){
        var data_idx = null;
        for(var ii = 0; ii < primary_x_data.length; ii++){
          if(target_name == primary_x_data[ii].device){
            data_idx = ii;
            break;
          }
        }

        // do the various maths on the target device data
        var regression = null;
        if(data_idx !== null) {
          // Count the number of given x values.
          // Calculate SUM(X), SUM(Y), SUM(X*Y), SUM(X^2) for the values
          var num_x_values = 0;
          var sum_xy_values = 0.0;
          var sum_x_values = 0.0;
          var sum_y_values = 0.0;
          var sum_x_squared_values = 0.0;
          // calculate the regression
          for (var ii = 0; ii < primary_x_data[data_idx].data.length; ii++) {
            var x_value = primary_x_moments[data_idx].data[ii];
            var y_value = primary_y_data[data_idx].data[ii];

            if (x_value != null && y_value != null && !isNaN(y_value)) {
              var unix_time = x_value.unix();
              sum_y_values += primary_y_data[data_idx].data[ii];
              sum_x_values += unix_time;
              sum_x_squared_values += unix_time * unix_time;
              sum_xy_values += unix_time * y_value;
              num_x_values++;
            }
          }

          // Slope(b) = (N * SUM(X*Y) - SUM(X)*SUM(Y) / (N * SUM(X^2) - (SUM(X))^2)
          // Intercept(a) = (SUM(Y) - b * SUM(X)) / N
          var slope = (num_x_values * sum_xy_values - sum_x_values * sum_y_values) / (num_x_values * sum_x_squared_values - (sum_x_values * sum_x_values));
          var intercept = (sum_y_values - slope * sum_x_values) / num_x_values;

          var y_mean = sum_y_values / num_x_values;
          var total_sum_of_squares = 0.0;
          var explained_sum_of_squares = 0.0;
          var residual_sum_of_squares = 0.0;
          // calculate the fit quality measures
          for (var ii = 0; ii < primary_x_data[data_idx].data.length; ii++) {
            var x_value = primary_x_moments[data_idx].data[ii];
            var y_value = primary_y_data[data_idx].data[ii];
            if (x_value != null && y_value != null && !isNaN(y_value)) {
              var unix_time = x_value.unix();
              var fit_value = unix_time * slope + intercept
              total_sum_of_squares += (y_value - y_mean) * (y_value - y_mean);
              explained_sum_of_squares += (fit_value - y_mean) * (fit_value - y_mean);
              residual_sum_of_squares += (y_value - fit_value) * (y_value - fit_value);
            }
          }

          var r_squared = 1 - (residual_sum_of_squares / total_sum_of_squares);

          var x_start = $scope.zoom_start_date.format("YYYY-MM-DD HH:mm:ss");
          var x_end = $scope.zoom_end_date.format("YYYY-MM-DD HH:mm:ss");
          var y_start = $scope.zoom_start_date.unix() * slope + intercept;
          var y_end = $scope.zoom_end_date.unix() * slope + intercept;
          var logtrace = {
            x: [x_start, x_end],
            y: [y_start, y_end],
            mode: 'lines',
            yaxis: 'y',
            type: 'scatter',
            name: target_name
          };

          var ach = -slope * 3600; // inverted and converted to LOG(ppm)/hour, slope is in LOG(ppm)/second
          var concentration_half_life = 60 * Math.log(2) / ach; // in minutes, because ach is in hours
          regression = {
            name: target_name,
            slope: slope,
            intercept: intercept,
            r_squared: r_squared,
            y_mean: y_mean,
            num_points: num_x_values,
            ACH: ach,
            concentration_half_life: concentration_half_life,
            trace: logtrace,
            start_basis_moment: moment($scope.zoom_start_date),
            end_basis_moment: moment($scope.zoom_end_date)
          };

          // add the regression to the list of calculated regressions
          var found = false;
          for(var ii = 0; ii < $scope.regressions.length; ii++){
            if($scope.regressions[ii].name == target_name){
              $scope.regressions[ii] = regression;
              found = true;
              break;
            }
          }
          if(!found){
            $scope.regressions.push(regression);
          }

        }

      }

      // if there are any regressions, add them to the plot
      // also calculate the summary statistics if you please
      var sum_ach = 0.0;
      var sum_r_squared = 0.0;
      var sum_concentration_half_life = 0.0;

      for(var ii = 0; ii < $scope.regressions.length; ii++){
        // go through all the regressions and re-evaluate the endpoints of the lines that are displayed
        var slope = $scope.regressions[ii].slope;
        var intercept = $scope.regressions[ii].intercept;
        var x_start = $scope.zoom_start_date.format("YYYY-MM-DD HH:mm:ss");
        var x_end = $scope.zoom_end_date.format("YYYY-MM-DD HH:mm:ss");
        var y_start = $scope.zoom_start_date.unix() * slope + intercept;
        var y_end = $scope.zoom_end_date.unix() * slope + intercept;
        $scope.regressions[ii].trace.x[0] = x_start;
        $scope.regressions[ii].trace.x[1] = x_end;
        $scope.regressions[ii].trace.y[0] = y_start;
        $scope.regressions[ii].trace.y[1] = y_end;
        logdata.push($scope.regressions[ii].trace);

        sum_ach += $scope.regressions[ii].ACH;
        sum_r_squared += $scope.regressions[ii].r_squared;
        sum_concentration_half_life += $scope.regressions[ii].concentration_half_life;
      }

      if($scope.regressions.length > 0){
        var num_regressions = $scope.regressions.length;
        $scope.summary_stats = {
          average_ACH: sum_ach / num_regressions,
          average_r_squared: sum_r_squared / num_regressions,
          average_concentration_half_life: sum_concentration_half_life / num_regressions
        };

        var ach_sum_error_squared = 0.0;
        var r_squared_sum_error_squared = 0.0;
        var concentration_half_life_sum_error_squared = 0.0;
        for(var ii = 0; ii < num_regressions; ii++){
          var error = ($scope.summary_stats.average_ACH - $scope.regressions[ii].ACH);
          ach_sum_error_squared +=  error * error;
          error = ($scope.summary_stats.average_r_squared - $scope.regressions[ii].r_squared);
          r_squared_sum_error_squared += error * error;
          error = ($scope.summary_stats.average_concentration_half_life - $scope.regressions[ii].concentration_half_life);
          concentration_half_life_sum_error_squared += error * error;
        }

        $scope.summary_stats.stdev_p_ACH = Math.sqrt(ach_sum_error_squared / num_regressions);
        $scope.summary_stats.stdev_p_r_squared = Math.sqrt(r_squared_sum_error_squared / num_regressions);
        $scope.summary_stats.stdev_p_concentration_half_life = Math.sqrt(concentration_half_life_sum_error_squared / num_regressions);

        $scope.summary_stats.rel_stdev_ACH = $scope.summary_stats.stdev_p_ACH / $scope.summary_stats.average_ACH;
        $scope.summary_stats.rel_stdev_r_squared =$scope.summary_stats.stdev_p_r_squared / $scope.summary_stats.average_r_squared;
        $scope.summary_stats.rel_stdev_concentration_half_life = $scope.summary_stats.stdev_p_concentration_half_life / $scope.summary_stats.average_concentration_half_life;
      }

      // plot the natural log of the data on the loglinear plot and keep the zooms in sync
      Plotly.newPlot('loglinear', logdata, loglayout);
    }
}]);