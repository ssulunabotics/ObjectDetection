#!/bin/bash


# Input file
input_file="Data/images_missing_label.txt"

# Output file
output_file="Data/extracted_images_missing_label.txt"

# Clear the output file
> "$output_file"

# Process the input file
while IFS= read -r line; do
    if [[ $line =~ Warning:\ Label\ not\ found\ for\ (.+\.png) ]]; then
        echo "${BASH_REMATCH[1]}" >> "$output_file"
    fi
done < "$input_file"

echo "Image file names extracted to: $output_file"



