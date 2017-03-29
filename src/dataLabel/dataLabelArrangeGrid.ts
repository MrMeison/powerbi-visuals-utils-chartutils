/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.utils.chart.dataLabel {
    // powerbi.extensibility.utils.svg.shapes
    import ISize = powerbi.extensibility.utils.svg.shapes.ISize;
    import IThickness = powerbi.extensibility.utils.svg.shapes.IThickness;
    import Rect = powerbi.extensibility.utils.svg.shapes.Rect;
    import IRect = powerbi.extensibility.utils.svg.IRect;

    // powerbi.extensibility.utils.type
    import Prototype = powerbi.extensibility.utils.type.Prototype;

    // powerbi.extensibility.utils.formatting
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

    /**
     * Utility class to speed up the conflict detection by collecting the arranged items in the DataLabelsPanel.
     */
    export class DataLabelArrangeGrid {
        private static ARRANGEGRID_MIN_COUNT: number = 1;
        private static ARRANGEGRID_MAX_COUNT: number = 100;
        private grid: IArrangeGridElementInfo[][][] = [];
        private cellSize: ISize;
        private rowCount: number;
        private colCount: number;

        /**
         * Creates new ArrangeGrid.
         * @param size The available size
         */
        constructor(size: ISize, elements: any[], layout: ILabelLayout) {
            if (size.width === 0 || size.height === 0) {
                this.cellSize = size;
                this.rowCount = this.colCount = 0;
            }

            const baseProperties: TextProperties = {
                fontFamily: utils.LabelTextProperties.fontFamily,
                fontSize: utils.LabelTextProperties.fontSize,
                fontWeight: utils.LabelTextProperties.fontWeight
            };

            // sets the cell size to be twice of the Max with and Max height of the elements
            this.cellSize = { width: 0, height: 0 };
            for (const child of elements) {
                // Fill label field
                child.labeltext = layout.labelText(child);

                const properties: TextProperties = Prototype.inherit(baseProperties);
                properties.text = child.labeltext;
                properties.fontSize = child.data
                    ? child.data.labelFontSize
                    : child.labelFontSize
                        ? child.labelFontSize
                        : utils.LabelTextProperties.fontSize;

                child.size = {
                    width: textMeasurementService.measureSvgTextWidth(properties),
                    height: textMeasurementService.estimateSvgTextHeight(properties)
                };

                const w: number = child.size.width * 2;
                const h: number = child.size.height * 2;

                if (w > this.cellSize.width) {
                    this.cellSize.width = w;
                }

                if (h > this.cellSize.height) {
                    this.cellSize.height = h;
                }
            }

            if (this.cellSize.width === 0) {
                this.cellSize.width = size.width;
            }

            if (this.cellSize.height === 0) {
                this.cellSize.height = size.height;
            }

            this.colCount = this.getGridRowColCount(
                this.cellSize.width,
                size.width,
                DataLabelArrangeGrid.ARRANGEGRID_MIN_COUNT,
                DataLabelArrangeGrid.ARRANGEGRID_MAX_COUNT);

            this.rowCount = this.getGridRowColCount(
                this.cellSize.height,
                size.height,
                DataLabelArrangeGrid.ARRANGEGRID_MIN_COUNT,
                DataLabelArrangeGrid.ARRANGEGRID_MAX_COUNT);

            this.cellSize.width = size.width / this.colCount;
            this.cellSize.height = size.height / this.rowCount;

            const grid: IArrangeGridElementInfo[][][] = this.grid;

            for (let x: number = 0; x < this.colCount; x += 1) {
                grid[x] = [];

                for (let y: number = 0; y < this.rowCount; y += 1) {
                    grid[x][y] = [];
                }
            }
        }

        /**
         * Register a new label element.
         * @param element The label element to register.
         * @param rect The label element position rectangle.
         */
        public add(element: IDataLabelInfo, rect: IRect): void {
            const indexRect: IThickness = this.getGridIndexRect(rect);
            const grid: IArrangeGridElementInfo[][][] = this.grid;

            for (let x: number = indexRect.left; x < indexRect.right; x += 1) {
                for (let y: number = indexRect.top; y < indexRect.bottom; y += 1) {
                    grid[x][y].push({ element: element, rect: rect });
                }
            }
        }

        /**
         * Checks for conflict of given rectangle in registered elements.
         * @param rect The rectengle to check.
         * @return True if conflict is detected.
         */
        public hasConflict(rect: IRect): boolean {
            const indexRect: IThickness = this.getGridIndexRect(rect);
            const grid: IArrangeGridElementInfo[][][] = this.grid;

            for (let x: number = indexRect.left; x < indexRect.right; x += 1) {
                for (let y: number = indexRect.top; y < indexRect.bottom; y += 1) {
                    for (let z: number = 0; z < grid[x][y].length; z += 1) {
                        const item: IArrangeGridElementInfo = grid[x][y][z];
                        if (Rect.isIntersecting(item.rect, rect)) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        /**
         * Calculates the number of rows or columns in a grid
         * @param step is the largest label size (width or height)
         * @param length is the grid size (width or height)
         * @param minCount is the minimum allowed size
         * @param maxCount is the maximum allowed size
         * @return the number of grid rows or columns
         */
        private getGridRowColCount(step: number, length: number, minCount: number, maxCount: number): number {
            return Math.min(Math.max(Math.ceil(length / step), minCount), maxCount);
        }

        /**
         * Returns the grid index of a given recangle
         * @param rect The rectengle to check.
         * @return grid index as a thickness object.
         */
        private getGridIndexRect(rect: IRect): IThickness {
            const restrict: (n: number, min: number, max: number) => number =
                (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

            return {
                left: restrict(Math.floor(rect.left / this.cellSize.width), 0, this.colCount),
                top: restrict(Math.floor(rect.top / this.cellSize.height), 0, this.rowCount),
                right: restrict(Math.ceil((rect.left + rect.width) / this.cellSize.width), 0, this.colCount),
                bottom: restrict(Math.ceil((rect.top + rect.height) / this.cellSize.height), 0, this.rowCount)
            };
        }
    }
}
